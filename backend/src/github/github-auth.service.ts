import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import * as crypto from 'crypto';
import { GithubAccount } from './entities/github-account.entity';
import { encryptToken, decryptToken } from './github.crypto';

/**
 * GithubAuthService — flujo OAuth 2.0 con GitHub y gestión de la cuenta vinculada.
 *
 * Flujo:
 *   1. buildAuthorizeUrl(state) → URL a la que redirigir al usuario.
 *   2. GitHub redirige al callback con ?code=... → exchangeCodeForToken(code).
 *   3. fetchGithubUser(token) obtiene login/avatar/id.
 *   4. upsertAccount() guarda la cuenta con el token CIFRADO.
 *
 * Requiere credenciales de una OAuth App de GitHub en variables de entorno:
 *   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_OAUTH_CALLBACK
 */
@Injectable()
export class GithubAuthService {
  constructor(
    @InjectRepository(GithubAccount)
    private readonly accountsRepo: Repository<GithubAccount>,
  ) {}

  // ── Configuración ──────────────────────────────────────────────────────────
  get clientId():     string { return process.env.GITHUB_CLIENT_ID || ''; }
  get clientSecret(): string { return process.env.GITHUB_CLIENT_SECRET || ''; }
  get callbackUrl():  string {
    return process.env.GITHUB_OAUTH_CALLBACK || 'http://localhost:3000/api/github/callback';
  }
  get frontendUrl():  string {
    return process.env.FRONTEND_URL || 'http://localhost:5173';
  }
  get isConfigured(): boolean {
    return !!this.clientId && !!this.clientSecret;
  }

  /**
   * Construye la URL de autorización de GitHub.
   * `state` es un token anti-CSRF que firma el id del usuario que inicia el flujo.
   */
  buildAuthorizeUrl(state: string): string {
    if (!this.isConfigured) {
      throw new BadRequestException(
        'La integración con GitHub no está configurada. Falta GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET en el servidor.',
      );
    }
    const params = new URLSearchParams({
      client_id:    this.clientId,
      redirect_uri: this.callbackUrl,
      scope:        'repo read:user user:email admin:repo_hook',
      state,
      allow_signup: 'false',
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  /** Genera un `state` firmado que contiene el id del usuario (anti-CSRF). */
  signState(userId: number): string {
    const nonce = crypto.randomBytes(8).toString('hex');
    const payload = `${userId}.${nonce}`;
    const sig = crypto
      .createHmac('sha256', this.clientSecret || 'kanbana-state')
      .update(payload)
      .digest('hex')
      .slice(0, 16);
    return Buffer.from(`${payload}.${sig}`).toString('base64url');
  }

  /** Verifica y decodifica el `state`, devolviendo el userId original. */
  verifyState(state: string): number {
    try {
      const decoded = Buffer.from(state, 'base64url').toString('utf8');
      const [userId, nonce, sig] = decoded.split('.');
      const expected = crypto
        .createHmac('sha256', this.clientSecret || 'kanbana-state')
        .update(`${userId}.${nonce}`)
        .digest('hex')
        .slice(0, 16);
      if (sig !== expected) throw new Error('firma inválida');
      return parseInt(userId, 10);
    } catch {
      throw new BadRequestException('Parámetro state inválido o manipulado.');
    }
  }

  /** Intercambia el `code` de OAuth por un access_token. */
  async exchangeCodeForToken(code: string): Promise<{ access_token: string; scope: string }> {
    try {
      const res = await axios.post(
        'https://github.com/login/oauth/access_token',
        {
          client_id:     this.clientId,
          client_secret: this.clientSecret,
          code,
          redirect_uri:  this.callbackUrl,
        },
        { headers: { Accept: 'application/json' } },
      );
      if (res.data.error || !res.data.access_token) {
        throw new BadRequestException(
          `GitHub rechazó el intercambio de código: ${res.data.error_description || res.data.error || 'sin token'}`,
        );
      }
      return { access_token: res.data.access_token, scope: res.data.scope || '' };
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      throw new InternalServerErrorException('No se pudo contactar a GitHub para el intercambio de token.');
    }
  }

  /** Obtiene los datos del usuario autenticado en GitHub. */
  async fetchGithubUser(accessToken: string): Promise<{ id: number; login: string; avatar_url: string }> {
    const res = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Kanbana-App/1.0',
      },
    });
    return { id: res.data.id, login: res.data.login, avatar_url: res.data.avatar_url };
  }

  /** Crea o actualiza la cuenta vinculada del usuario (token cifrado). */
  async upsertAccount(
    userId: number,
    gh: { id: number; login: string; avatar_url: string },
    accessToken: string,
    scope: string,
  ): Promise<GithubAccount> {
    const enc = encryptToken(accessToken);
    let account = await this.accountsRepo.findOne({ where: { user_id: userId } });
    if (account) {
      account.github_id    = gh.id;
      account.github_login = gh.login;
      account.avatar_url   = gh.avatar_url;
      account.access_token = enc;
      account.scope        = scope;
    } else {
      account = this.accountsRepo.create({
        user_id:      userId,
        github_id:    gh.id,
        github_login: gh.login,
        avatar_url:   gh.avatar_url,
        access_token: enc,
        scope,
      });
    }
    return this.accountsRepo.save(account);
  }

  /** Devuelve el access_token DESCIFRADO del usuario (uso interno). */
  async getDecryptedToken(userId: number): Promise<string | null> {
    const account = await this.accountsRepo
      .createQueryBuilder('a')
      .addSelect('a.access_token')
      .where('a.user_id = :userId', { userId })
      .getOne();
    if (!account?.access_token) return null;
    try {
      return decryptToken(account.access_token);
    } catch {
      return null;
    }
  }

  /** Estado de conexión del usuario (sin exponer el token). */
  async getStatus(userId: number): Promise<{
    conectado: boolean;
    configurado: boolean;
    github_login?: string;
    avatar_url?: string;
    scope?: string;
    conectado_en?: Date;
  }> {
    const account = await this.accountsRepo.findOne({ where: { user_id: userId } });
    return {
      conectado:    !!account,
      configurado:  this.isConfigured,
      github_login: account?.github_login,
      avatar_url:   account?.avatar_url,
      scope:        account?.scope,
      conectado_en: account?.conectado_en,
    };
  }

  async disconnect(userId: number): Promise<{ ok: boolean }> {
    await this.accountsRepo.delete({ user_id: userId });
    return { ok: true };
  }
}
