import {
  Injectable, UnauthorizedException, NotFoundException, BadRequestException
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
// ── CAMBIO: importamos nodemailer para enviar el email real ───────────────
import * as nodemailer from 'nodemailer';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(correo: string, pass: string): Promise<any> {
    const user = await this.usersService.findByEmail(correo);
    if (user && (await bcrypt.compare(pass, user.contrasena))) {
      const { contrasena, ...result } = user as any;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { sub: user.id, email: user.correo, rol: user.rol };
    const access_token = this.jwtService.sign(payload, {
      expiresIn: Number(process.env.JWT_ACCESS_EXPIRES) || 60 * 15,
    });
    const refresh_token = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET || 'kanbana_refresh_secreto_diferente_al_anterior',
      expiresIn: Number(process.env.JWT_REFRESH_EXPIRES) || 60 * 60 * 24 * 7,
    });
    return { user, tokens: { access_token, refresh_token } };
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
      await this.usersService.confirmAccount(token);
      return { message: 'Cuenta confirmada exitosamente' };
    } catch {
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