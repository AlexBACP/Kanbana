import {
  Injectable, UnauthorizedException, NotFoundException, BadRequestException, ConflictException
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { GithubAuthService } from '../github/github-auth.service';
import { Ficha } from '../fichas/entities/ficha.entity';
import { NotificationType } from '../notifications/entities/notification.entity';
import { assertPasswordPolicy } from '../common/password.util';
import axios from 'axios';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import * as otplib from 'otplib';
import * as QRCode from 'qrcode';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private notificationsService: NotificationsService,
    private githubAuthService: GithubAuthService,
    @InjectRepository(Ficha)
    private fichaRepo: Repository<Ficha>,
  ) {}

  async validateUser(correo: string, pass: string): Promise<any> {
    // Guarda de entrada: sin correo o contraseña → credenciales inválidas.
    // Evita además que findByEmail(undefined) en TypeORM ignore el filtro y
    // devuelva un usuario arbitrario, y que bcrypt.compare lance un 500.
    if (!correo || !pass) return null;

    const user = await this.usersService.findByEmail(correo);
    if (!user || !user.contrasena) return null;

    const passwordOk = await bcrypt.compare(pass, user.contrasena);
    if (!passwordOk) return null;

    // Bloquear aprendices invitados que aún no confirmaron su correo
    if (!user.cuenta_confirmada && (user as any).token_activacion) {
      throw new UnauthorizedException(
        'Debes confirmar tu cuenta desde el correo de invitación antes de ingresar.'
      );
    }

    const { contrasena, token_activacion, ...result } = user as any;
    return result;
  }

  /**
   * Registro público de auto-servicio. Crea SIEMPRE una cuenta de aprendiz,
   * activa y confirmada (login inmediato). Valida correo y duplicados.
   * El rol enviado por el cliente se ignora (no se puede auto-asignar otro rol).
   */
  async register(dto: { nombre?: string; correo?: string; contrasena?: string }): Promise<{ id: number; nombre: string; correo: string; requiere_confirmacion: boolean; mensaje: string }> {
    const nombre = (dto?.nombre || '').trim();
    const correo = (dto?.correo || '').trim().toLowerCase();
    const contrasena = dto?.contrasena || '';

    if (!nombre || !correo || !contrasena) {
      throw new BadRequestException('Nombre, correo y contraseña son obligatorios.');
    }
    // Debe ser un correo de Google bien formado (reglas de Gmail: parte local
    // de 6-30 caracteres alfanuméricos con puntos no consecutivos).
    const gmailRe = /^[a-z0-9](\.?[a-z0-9]){5,29}@(gmail|googlemail)\.com$/i;
    if (!gmailRe.test(correo)) {
      throw new BadRequestException('Debes registrarte con un correo de Google válido (@gmail.com).');
    }
    // ── Política de contraseña: ≥7 caracteres, ≥1 mayúscula, ≥1 número ──────
    assertPasswordPolicy(contrasena);

    const existing = await this.usersService.findByEmail(correo);
    if (existing) {
      throw new ConflictException('Ya existe una cuenta registrada con ese correo.');
    }

    // Crea un aprendiz SIN confirmar + envía correo de confirmación.
    // No podrá iniciar sesión hasta confirmar (validateUser lo bloquea).
    const user: any = await this.usersService.createSelfRegistered({ nombre, correo, contrasena });
    return {
      id: user.id,
      nombre: user.nombre,
      correo: user.correo,
      requiere_confirmacion: true,
      mensaje: 'Cuenta creada. Te enviamos un correo para confirmar tu cuenta antes de iniciar sesión.',
    };
  }

  /**
   * Registro de APRENDIZ con ficha + jornada en un solo paso:
   *   1. Valida datos y que la ficha exista (jornada coincidente) ANTES de crear.
   *   2. Crea la cuenta de aprendiz (sin confirmar) y envía correo de confirmación.
   *   3. Crea la solicitud de vinculación (estado pendiente) y notifica al instructor.
   * Así, al confirmar el correo e iniciar sesión, el aprendiz ya aparece como
   * "esperando aprobación" y el instructor ya recibió la solicitud.
   */
  async registerAprendiz(dto: {
    nombre?: string; correo?: string; contrasena?: string;
    codigoFicha?: string; jornada?: string; documento?: string;
  }): Promise<{ id: number; requiere_confirmacion: boolean; mensaje: string }> {
    const nombre = (dto?.nombre || '').trim();
    const correo = (dto?.correo || '').trim().toLowerCase();
    const contrasena = dto?.contrasena || '';
    const documento = (dto?.documento || '').trim();

    if (!nombre || !correo || !contrasena) {
      throw new BadRequestException('Nombre, correo y contraseña son obligatorios.');
    }
    const gmailRe = /^[a-z0-9](\.?[a-z0-9]){5,29}@(gmail|googlemail)\.com$/i;
    if (!gmailRe.test(correo)) {
      throw new BadRequestException('Debes registrarte con un correo de Google válido (@gmail.com).');
    }
    if (!documento) throw new BadRequestException('Debes indicar tu número de documento.');
    assertPasswordPolicy(contrasena);

    const existing = await this.usersService.findByEmail(correo);
    if (existing) {
      throw new ConflictException('Ya existe una cuenta registrada con ese correo.');
    }

    // Validar la ficha ANTES de crear la cuenta (evita cuentas huérfanas).
    await this.usersService.validarFichaVinculacion(dto.codigoFicha as any, dto.jornada as any);

    // Crear la cuenta (sin confirmar) + correo de confirmación.
    const user: any = await this.usersService.createSelfRegistered({ nombre, correo, contrasena });

    // Crear la solicitud de vinculación (estado pendiente) + notificar instructor.
    await this.usersService.solicitarVinculacion(user.id, {
      codigoFicha: dto.codigoFicha as any,
      jornada:     dto.jornada as any,
      documento,
    });

    return {
      id: user.id,
      requiere_confirmacion: true,
      mensaje: 'Cuenta creada y solicitud enviada a tu instructor. Confirma tu correo para iniciar sesión; luego verás el estado de tu vinculación.',
    };
  }

  /**
   * Lee la lista de dominios SENA aceptados desde la env. Soporta varios
   * separados por comas. Cada uno debe empezar con '@' o se le añade.
   * Ejemplo de env: SENA_INSTRUCTOR_DOMAINS="@sena.edu.co"
   * Default: "@sena.edu.co" si la env no está definida.
   */
  private senaInstructorDomains(): string[] {
    const raw = process.env.SENA_INSTRUCTOR_DOMAINS || '@sena.edu.co';
    return raw.split(',')
      .map(d => d.trim().toLowerCase())
      .filter(Boolean)
      .map(d => d.startsWith('@') ? d : `@${d}`);
  }

  /**
   * Registro de INSTRUCTOR con correo institucional SENA.
   *
   * Dos capas de seguridad:
   *   Capa 1: el correo termina en un dominio SENA permitido (env).
   *   Capa 2: el instructor confirma su correo (cuenta_confirmada=true).
   *
   * Hasta que la Capa 2 no pase, el login está bloqueado con un mensaje claro.
   */
  async registerInstructor(dto: {
    nombre?: string; correo?: string; contrasena?: string;
  }): Promise<{ id: number; requiere_confirmacion: boolean; mensaje: string }> {
    const nombre = (dto?.nombre || '').trim();
    const correo = (dto?.correo || '').trim().toLowerCase();
    const contrasena = dto?.contrasena || '';

    if (!nombre || !correo || !contrasena) {
      throw new BadRequestException('Nombre, correo y contraseña son obligatorios.');
    }

    // ── Capa 1: validar dominio SENA ──────────────────────────────────────
    const allowedDomains = this.senaInstructorDomains();
    const domainOk = allowedDomains.some(d => correo.endsWith(d));
    if (!domainOk) {
      throw new BadRequestException(
        `El registro de instructor requiere un correo institucional SENA (${allowedDomains.join(', ')}). ` +
        `Si eres aprendiz, regístrate desde la opción "Soy aprendiz".`,
      );
    }

    assertPasswordPolicy(contrasena);

    const existing = await this.usersService.findByEmail(correo);
    if (existing) {
      throw new ConflictException('Ya existe una cuenta registrada con ese correo.');
    }

    // El correo de confirmación se envía dentro de createSelfRegisteredInstructor.
    const user: any = await this.usersService.createSelfRegisteredInstructor({
      nombre, correo, contrasena,
    });

    return {
      id: user.id,
      requiere_confirmacion: true,
      mensaje:
        'Cuenta creada. Te enviamos un correo de confirmación a tu cuenta SENA. ' +
        'Tras confirmarlo ya puedes iniciar sesión.',
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LOGIN CON GOOGLE (OAuth 2.0 / OIDC)
  // ══════════════════════════════════════════════════════════════════════════
  private get googleClientId():     string { return process.env.GOOGLE_CLIENT_ID || ''; }
  private get googleClientSecret(): string { return process.env.GOOGLE_CLIENT_SECRET || ''; }
  private get googleCallbackUrl():  string { return process.env.GOOGLE_OAUTH_CALLBACK || 'http://localhost:3000/api/auth/google/callback'; }
  get frontendUrl():                string { return process.env.FRONTEND_URL || 'http://localhost:5173'; }
  get googleConfigured():           boolean { return !!this.googleClientId && !!this.googleClientSecret; }

  /** state firmado (anti-CSRF, sin estado en servidor). */
  private signGoogleState(): string {
    const payload = `${crypto.randomBytes(8).toString('hex')}.${Date.now()}`;
    const sig = crypto.createHmac('sha256', process.env.JWT_SECRET || 'kanbana')
      .update(payload).digest('hex').slice(0, 16);
    return Buffer.from(`${payload}.${sig}`).toString('base64url');
  }
  private verifyGoogleState(state: string): boolean {
    try {
      const [nonce, ts, sig] = Buffer.from(state, 'base64url').toString('utf8').split('.');
      const exp = crypto.createHmac('sha256', process.env.JWT_SECRET || 'kanbana')
        .update(`${nonce}.${ts}`).digest('hex').slice(0, 16);
      return sig === exp && (Date.now() - Number(ts)) < 10 * 60 * 1000;
    } catch { return false; }
  }

  /** URL de autorización de Google a la que se redirige al usuario. */
  googleAuthUrl(): string {
    if (!this.googleConfigured) {
      throw new BadRequestException('El login con Google no está configurado en el servidor.');
    }
    const params = new URLSearchParams({
      client_id:     this.googleClientId,
      redirect_uri:  this.googleCallbackUrl,
      response_type: 'code',
      scope:         'openid email profile',
      state:         this.signGoogleState(),
      access_type:   'online',
      prompt:        'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /** Callback: intercambia el código, obtiene el perfil, busca/crea y emite JWT. */
  async googleCallback(code: string, state: string): Promise<{ user: any; tokens: { access_token: string; refresh_token: string } }> {
    if (!code) throw new BadRequestException('Falta el código de autorización.');
    if (!this.verifyGoogleState(state)) throw new BadRequestException('Parámetro state inválido o expirado.');

    // 1. Intercambiar el código por un access_token de Google
    let accessToken: string;
    try {
      const res = await axios.post(
        'https://oauth2.googleapis.com/token',
        new URLSearchParams({
          code,
          client_id:     this.googleClientId,
          client_secret: this.googleClientSecret,
          redirect_uri:  this.googleCallbackUrl,
          grant_type:    'authorization_code',
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );
      accessToken = res.data.access_token;
      if (!accessToken) throw new Error('sin access_token');
    } catch {
      throw new BadRequestException('No se pudo validar el inicio de sesión con Google.');
    }

    // 2. Obtener el perfil (OIDC userinfo)
    const profile = (await axios.get('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })).data;

    const email = (profile.email || '').toLowerCase();
    if (!email || profile.email_verified === false) {
      throw new BadRequestException('Google no entregó un correo verificado.');
    }

    // 3. Buscar o crear el usuario
    const user = await this.usersService.findOrCreateGoogleUser({
      email,
      nombre:   profile.name || email.split('@')[0],
      googleId: profile.sub,
      picture:  profile.picture,
    });

    // 4. Emitir nuestros tokens (reusa login)
    return this.login(user);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LOGIN CON GITHUB (OAuth 2.0 — solo para autenticación, no para repos)
  //
  // Usa los mismos GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET que la integración
  // de repos, pero con un callback diferente (GITHUB_LOGIN_CALLBACK) y un
  // scope mínimo: read:user + user:email.
  // ══════════════════════════════════════════════════════════════════════════

  private get githubClientId():      string { return process.env.GITHUB_CLIENT_ID || ''; }
  private get githubClientSecret():  string { return process.env.GITHUB_CLIENT_SECRET || ''; }
  private get githubLoginCallbackUrl(): string {
    return process.env.GITHUB_LOGIN_CALLBACK || 'http://localhost:3000/api/auth/github/callback';
  }
  get githubLoginConfigured(): boolean { return !!this.githubClientId && !!this.githubClientSecret; }

  /** State firmado (anti-CSRF) para el flujo de login con GitHub. */
  private signGithubLoginState(): string {
    const payload = `${crypto.randomBytes(8).toString('hex')}.${Date.now()}`;
    const sig = crypto.createHmac('sha256', process.env.JWT_SECRET || 'kanbana')
      .update(payload).digest('hex').slice(0, 16);
    return Buffer.from(`${payload}.${sig}`).toString('base64url');
  }

  private verifyGithubLoginState(state: string): boolean {
    try {
      const [nonce, ts, sig] = Buffer.from(state, 'base64url').toString('utf8').split('.');
      const exp = crypto.createHmac('sha256', process.env.JWT_SECRET || 'kanbana')
        .update(`${nonce}.${ts}`).digest('hex').slice(0, 16);
      return sig === exp && (Date.now() - Number(ts)) < 10 * 60 * 1000;
    } catch { return false; }
  }

  /** URL de autorización de GitHub para login (scope mínimo). */
  githubLoginAuthUrl(): string {
    if (!this.githubLoginConfigured) {
      throw new BadRequestException('El login con GitHub no está configurado en el servidor.');
    }
    const params = new URLSearchParams({
      client_id:    this.githubClientId,
      redirect_uri: this.githubLoginCallbackUrl,
      // Scope ampliado: además de identidad (read:user, user:email) pedimos
      // repo + admin:repo_hook para que el MISMO inicio de sesión deje la cuenta
      // lista para vincular repositorios sin tener que re-conectar en Configuración.
      scope:        'read:user user:email repo admin:repo_hook',
      state:        this.signGithubLoginState(),
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  /**
   * Callback de GitHub — intercambia el código por un token, obtiene el
   * email verificado, busca o crea el usuario y emite nuestros JWT.
   */
  async githubLoginCallback(code: string, state: string): Promise<{ user: any; tokens: { access_token: string; refresh_token: string } }> {
    if (!code) throw new BadRequestException('Falta el código de autorización.');
    if (!this.verifyGithubLoginState(state)) throw new BadRequestException('Parámetro state inválido o expirado.');

    // 1. Intercambiar código por access_token de GitHub
    let ghToken: string;
    try {
      const res = await axios.post(
        'https://github.com/login/oauth/access_token',
        {
          client_id:     this.githubClientId,
          client_secret: this.githubClientSecret,
          code,
          redirect_uri:  this.githubLoginCallbackUrl,
        },
        { headers: { Accept: 'application/json' } },
      );
      ghToken = res.data.access_token;
      if (!ghToken) throw new Error('sin access_token');
    } catch {
      throw new BadRequestException('No se pudo validar el inicio de sesión con GitHub.');
    }

    const ghHeaders = {
      Authorization: `Bearer ${ghToken}`,
      Accept:        'application/vnd.github+json',
      'User-Agent':  'Kanbana-App/1.0',
    };

    // 2. Obtener perfil básico (id, nombre, avatar)
    const profile = (await axios.get('https://api.github.com/user', { headers: ghHeaders })).data;

    // 3. Obtener email verificado (puede ser privado → /user/emails)
    let email: string | null = null;
    if (profile.email) {
      email = (profile.email as string).toLowerCase();
    } else {
      const emails: any[] = (
        await axios.get('https://api.github.com/user/emails', { headers: ghHeaders })
      ).data;
      const primary = emails.find(e => e.primary && e.verified);
      email = primary ? (primary.email as string).toLowerCase() : null;
    }

    if (!email) {
      throw new BadRequestException(
        'Tu cuenta de GitHub no tiene un correo electrónico verificado. ' +
        'Añade y verifica uno en github.com/settings/emails e intenta de nuevo.',
      );
    }

    // 4. Buscar / crear usuario de Kanbana
    const user = await this.usersService.findOrCreateGithubLoginUser({
      email,
      nombre:    profile.name || profile.login || email.split('@')[0],
      githubId:  String(profile.id),
      avatarUrl: profile.avatar_url,
    });

    // 5. Guardar la cuenta de GitHub para la integración de repos.
    //    Así, quien inicia sesión con GitHub queda YA conectado para vincular
    //    repositorios — sin tener que re-conectar en Configuración.
    try {
      await this.githubAuthService.upsertAccount(
        user.id,
        { id: profile.id, login: profile.login, avatar_url: profile.avatar_url },
        ghToken,
        'read:user user:email repo admin:repo_hook',
      );
    } catch (err: any) {
      // No bloquea el login si falla el guardado de la cuenta de repos.
      console.error('[AuthService] No se pudo guardar la cuenta GitHub tras login:', err?.message);
    }

    // 6. Emitir nuestros tokens JWT
    return this.login(user);
  }

  async login(user: any) {
    // Nunca devolver el secreto TOTP al cliente
    const { totp_secret, contrasena, ...safeUser } = user;
    const payload = { sub: safeUser.id, email: safeUser.correo, rol: safeUser.rol };
    const access_token = this.jwtService.sign(payload, {
      // Acepta string ('2h', '30m') o número en segundos. Default: 2h en producción.
      expiresIn: (process.env.JWT_ACCESS_EXPIRES || '2h') as any,
    });
    const refresh_token = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET || 'kanbana_refresh_secreto_diferente_al_anterior',
      expiresIn: Number(process.env.JWT_REFRESH_EXPIRES) || 60 * 60 * 24 * 7,
    });
    return { user: safeUser, tokens: { access_token, refresh_token } };
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 2FA — TOTP (Google Authenticator / Authy)
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Genera un secreto TOTP y lo guarda en el usuario (sin activar aún).
   * Devuelve el data URL del QR code para que el usuario lo escanee.
   */
  async setup2fa(userId: number): Promise<{ secret: string; qrCodeDataUrl: string }> {
    const user = await this.usersService.findOne(userId);
    const secret = otplib.generateSecret({ length: 20 });
    const otpAuthUrl = otplib.generateURI({ label: user.correo, issuer: 'Kanbana SENA', secret });
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl, {
      width: 200,
      margin: 2,
      color: { dark: '#f4f4f5', light: '#09090b' },
    });

    // Guardar el secreto (sin activar todavía — el usuario debe confirmar con un código)
    await this.usersService.update(userId, { totp_secret: secret } as any);
    return { secret, qrCodeDataUrl };
  }

  /**
   * Verifica el código que el usuario escaneó y activa el 2FA.
   * Lanza UnauthorizedException si el código es inválido.
   */
  async enable2fa(userId: number, code: string): Promise<{ success: true }> {
    const user = await this.usersService.findWithTotpSecret(userId);
    if (!user?.totp_secret) {
      throw new BadRequestException('Primero genera el QR desde "Configurar 2FA".');
    }
    if (!this.checkTotp(user.totp_secret, code)) {
      throw new UnauthorizedException('Código inválido. Verifica que la hora de tu dispositivo sea correcta.');
    }
    await this.usersService.update(userId, { totp_enabled: true } as any);
    return { success: true };
  }

  /**
   * Desactiva el 2FA verificando un código válido primero.
   */
  async disable2fa(userId: number, code: string): Promise<{ success: true }> {
    const user = await this.usersService.findWithTotpSecret(userId);
    if (!user?.totp_enabled) {
      throw new BadRequestException('El 2FA no está activado en tu cuenta.');
    }
    if (!this.checkTotp(user.totp_secret, code)) {
      throw new UnauthorizedException('Código inválido.');
    }
    await this.usersService.update(userId, { totp_enabled: false, totp_secret: null } as any);
    return { success: true };
  }

  /**
   * Verifica un código TOTP durante el login (uso interno del controlador).
   * Lanza UnauthorizedException si es inválido.
   */
  async verifyLoginTotp(userId: number, code: string): Promise<void> {
    const user = await this.usersService.findWithTotpSecret(userId);
    if (!user?.totp_secret || !this.checkTotp(user.totp_secret, code)) {
      throw new UnauthorizedException('Código 2FA inválido o expirado.');
    }
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || 'kanbana_refresh_secreto_diferente_al_anterior',
      });
      const user = await this.usersService.findOne(payload.sub);
      return this.login(user);
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // Helper privado — compatible con otplib v13+ (API funcional)
  // ══════════════════════════════════════════════════════════════════════════════
  private checkTotp(secret: string, code: string): boolean {
    try {
      const result = (otplib as any).verifySync({ token: code, secret, type: 'totp' });
      return typeof result === 'object' ? result.valid : !!result;
    } catch {
      return false;
    }
  }

  // ── CAMBIO: ahora envía email real en lugar de solo console.log ─────────
  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);

    // Respuesta genérica siempre (no revelar si el correo existe o no)
    if (!user) {
      return { message: 'Si el correo existe, recibirás un enlace en breve.' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 30);

    await this.usersService.update(user.id, {
      reset_password_token: token,
      reset_password_expires: expires,
    });

    // ── CAMBIO: llamar al método de envío real ───────────────────────────
    await this.sendResetEmail(email, user.nombre, token, expires);

    return { message: 'Si el correo existe, recibirás un enlace en breve.' };
  }

  async resetPassword(token: string, pass: string) {
    const user = await this.usersService.findByResetToken(token);

    if (!user || new Date() > user.reset_password_expires) {
      throw new BadRequestException('Token inválido o expirado');
    }

    // Misma política de contraseña que el registro
    assertPasswordPolicy(pass);

    // IMPORTANTE: usersService.update() hashea internamente el campo contrasena.
    // No pre-hashear aquí → evita el doble bcrypt.hash que rompía el login.
    await this.usersService.update(user.id, {
      contrasena: pass,           // texto plano — update() lo hashea una sola vez
      reset_password_token: null,
      reset_password_expires: null,
    });

    return { message: 'Contraseña actualizada con éxito' };
  }

  async confirmAccount(token: string) {
    try {
      const aprendiz = await this.usersService.confirmAccount(token);

      // Notificar al instructor si el aprendiz pertenece a una ficha
      if (aprendiz?.fichaId) {
        const ficha = await this.fichaRepo.findOne({ where: { id: aprendiz.fichaId } });
        if (ficha?.instructor_id) {
          await this.notificationsService.create({
            usuario_id: ficha.instructor_id,
            titulo:     '✅ Aprendiz confirmó su cuenta',
            mensaje:    `${aprendiz.nombre} confirmó su correo y ya puede ingresar a Kanbana.`,
            tipo:       NotificationType.SUCCESS,
          });
        }
      }

      return { message: 'Cuenta confirmada exitosamente' };
    } catch (e: any) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException('Token inválido o ya utilizado');
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PQRS — Peticiones, Quejas, Reclamos y Sugerencias (endpoint público)
  // ════════════════════════════════════════════════════════════════════════════
  async sendPqrs(dto: {
    nombre:  string;
    correo:  string;
    tipo:    'peticion' | 'queja' | 'reclamo' | 'sugerencia';
    mensaje: string;
  }): Promise<void> {
    const tipoLabel: Record<string, string> = {
      peticion:   'Petición',
      queja:      'Queja',
      reclamo:    'Reclamo',
      sugerencia: 'Sugerencia',
    };
    const label = tipoLabel[dto.tipo] ?? dto.tipo;

    const transporter = nodemailer.createTransport({
      host:   process.env.MAIL_HOST   || 'smtp.gmail.com',
      port:   Number(process.env.MAIL_PORT) || 587,
      secure: process.env.MAIL_SECURE === 'true',
      auth:   { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
    });

    const destino = process.env.ADMIN_EMAIL || process.env.MAIL_USER;
    const fecha   = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });

    await transporter.sendMail({
      from:    `"Kanbana PQRS" <${process.env.MAIL_USER}>`,
      to:      destino,
      replyTo: dto.correo,
      subject: `[PQRS · ${label}] De: ${dto.nombre}`,
      html: `
        <!DOCTYPE html>
        <html lang="es">
        <head><meta charset="UTF-8"></head>
        <body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:40px 16px;">
            <tr><td align="center">
              <table width="100%" style="max-width:520px;background:#18181b;border:1px solid #3f3f46;border-radius:12px;padding:40px;">
                <tr><td>
                  <p style="margin:0 0 6px;font-size:10px;font-weight:900;letter-spacing:4px;text-transform:uppercase;color:#22d3ee;">KANBANA · PQRS</p>
                  <h1 style="margin:0 0 4px;font-size:20px;font-weight:900;color:#f4f4f5;">${label}</h1>
                  <p style="margin:0 0 28px;font-size:11px;color:#52525b;">${fecha}</p>

                  <table width="100%" style="margin-bottom:20px;border:1px solid #3f3f46;border-radius:8px;overflow:hidden;">
                    <tr style="background:#09090b;">
                      <td style="padding:10px 14px;font-size:11px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:2px;width:90px;">Nombre</td>
                      <td style="padding:10px 14px;font-size:13px;color:#f4f4f5;">${dto.nombre}</td>
                    </tr>
                    <tr>
                      <td style="padding:10px 14px;font-size:11px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:2px;">Correo</td>
                      <td style="padding:10px 14px;font-size:13px;color:#22d3ee;">${dto.correo}</td>
                    </tr>
                    <tr style="background:#09090b;">
                      <td style="padding:10px 14px;font-size:11px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:2px;">Tipo</td>
                      <td style="padding:10px 14px;font-size:13px;color:#f4f4f5;">${label}</td>
                    </tr>
                  </table>

                  <div style="background:#09090b;border:1px solid #3f3f46;border-radius:8px;padding:16px;margin-bottom:24px;">
                    <p style="margin:0 0 8px;font-size:10px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:2px;">Mensaje</p>
                    <p style="margin:0;font-size:14px;line-height:1.7;color:#a1a1aa;white-space:pre-wrap;">${dto.mensaje}</p>
                  </div>

                  <p style="margin:0;font-size:11px;color:#52525b;">
                    Responde directamente a este correo para contactar a ${dto.nombre}.
                  </p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
      text: `PQRS · ${label}\nDe: ${dto.nombre} <${dto.correo}>\n\n${dto.mensaje}`,
    });
  }

  // ── CAMBIO: método privado con nodemailer — lee credenciales del .env ───
  private async sendResetEmail(correo: string, nombre: string, token: string, expires: Date) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink   = `${frontendUrl}/reset-password?token=${token}`;

    const transporter = nodemailer.createTransport({
      host:   process.env.MAIL_HOST || 'smtp.gmail.com',
      port:   Number(process.env.MAIL_PORT) || 587,
      secure: process.env.MAIL_SECURE === 'true',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    const horaExpiracion = expires.toLocaleTimeString('es-CO', {
      hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota',
    });

    await transporter.sendMail({
      from:    `"Kanbana SENA" <${process.env.MAIL_USER}>`,
      to:      correo,
      subject: 'Recuperación de contraseña — Kanbana',
      html: `
        <!DOCTYPE html>
        <html lang="es">
        <head><meta charset="UTF-8"></head>
        <body style="margin:0;padding:0;background:#0f0f13;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f13;padding:40px 16px;">
            <tr><td align="center">
              <table width="100%" style="max-width:480px;background:#1a1a24;border:1px solid #2a2a3a;border-radius:16px;padding:40px;">
                <tr><td>
                  <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:#7c6af7;">KANBANA</p>
                  <h1 style="margin:0 0 24px;font-size:22px;font-weight:700;color:#e8e8f0;">Recupera tu contraseña</h1>
                  <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#9898b0;">
                    Hola <strong style="color:#e8e8f0;">${nombre}</strong>,
                  </p>
                  <p style="margin:0 0 28px;font-size:14px;line-height:1.6;color:#9898b0;">
                    Recibimos una solicitud para restablecer la contraseña de tu cuenta.
                    Este enlace es válido por <strong style="color:#e8e8f0;">30 minutos</strong> (hasta las ${horaExpiracion}).
                  </p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr><td align="center" style="padding-bottom:28px;">
                      <a href="${resetLink}" style="display:inline-block;padding:14px 32px;background:#6c5ce7;color:#fff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:700;">
                        Restablecer contraseña
                      </a>
                    </td></tr>
                  </table>
                  <p style="margin:0 0 8px;font-size:12px;color:#606078;">Si el botón no funciona, copia este enlace:</p>
                  <p style="margin:0 0 28px;font-size:11px;color:#7c6af7;word-break:break-all;">${resetLink}</p>
                  <hr style="border:none;border-top:1px solid #2a2a3a;margin:0 0 20px;">
                  <p style="margin:0;font-size:11px;color:#505068;line-height:1.6;">
                    Si no solicitaste este cambio, ignora este correo. Tu contraseña no será modificada.
                  </p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
      text: `Hola ${nombre},\n\nEnlace para restablecer tu contraseña:\n${resetLink}\n\nVálido 30 minutos. Si no lo solicitaste, ignora este correo.`,
    });
  }
}