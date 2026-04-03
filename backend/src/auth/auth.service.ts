import {
  Injectable, UnauthorizedException, NotFoundException, BadRequestException
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

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

    // 🔥 CAMBIO 1:
    // Antes: expiresIn: '15m'
    // Problema: TypeScript no acepta bien el string (StringValue)
    // Solución: usar segundos (number)
    const access_token = this.jwtService.sign(payload, {
      expiresIn: Number(process.env.JWT_ACCESS_EXPIRES) || 60 * 15, // 15 minutos
    });

    // 🔥 CAMBIO 2:
    // Igual que arriba, convertimos a número
    const refresh_token = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET || 'kanbana_refresh_secreto_diferente_al_anterior',
      expiresIn: Number(process.env.JWT_REFRESH_EXPIRES) || 60 * 60 * 24 * 7, // 7 días
    });

    return {
      user,
      tokens: { access_token, refresh_token },
    };
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

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const token = crypto.randomBytes(20).toString('hex');

    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 30);

    await this.usersService.update(user.id, {
      reset_password_token: token,
      reset_password_expires: expires,
    });

    // 🔥 Esto es solo debug, en producción enviarías email
    console.log(`Reset token para ${email}: ${token}`);

    return { message: 'Enlace de recuperación enviado al correo' };
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
}