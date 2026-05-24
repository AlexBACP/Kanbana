import {
  Injectable, UnauthorizedException, NotFoundException, BadRequestException
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Ficha } from '../fichas/entities/ficha.entity';
import { NotificationType } from '../notifications/entities/notification.entity';
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
    @InjectRepository(Ficha)
    private fichaRepo: Repository<Ficha>,
  ) {}

  async validateUser(correo: string, pass: string): Promise<any> {
    const user = await this.usersService.findByEmail(correo);
    if (!user) return null;

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

  async login(user: any) {
    // Nunca devolver el secreto TOTP al cliente
    const { totp_secret, contrasena, ...safeUser } = user;
    const payload = { sub: safeUser.id, email: safeUser.correo, rol: safeUser.rol };
    const access_token = this.jwtService.sign(payload, {
      expiresIn: Number(process.env.JWT_ACCESS_EXPIRES) || 60 * 15,
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

    const hashedContrasena = await bcrypt.hash(pass, 10);

    await this.usersService.update(user.id, {
      contrasena: hashedContrasena,
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