import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';

// ── Resolver el secret a tiempo de carga ───────────────────────────────────
// En producción JWT_SECRET es obligatorio: si falta, el proceso debe morir
// inmediatamente en vez de arrancar con un secret hardcodeado (riesgo grave
// de seguridad — cualquiera con acceso al repo puede falsificar tokens).
const resolveJwtSecret = (): string => {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv && fromEnv.length >= 16) return fromEnv;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET es obligatorio en producción (mínimo 16 caracteres). ' +
      'Defínelo en las variables de entorno antes de iniciar el servidor.'
    );
  }

  // Sólo en dev/local: fallback con aviso explícito en consola.
  console.warn(
    '[JwtStrategy] ⚠ Usando JWT_SECRET por defecto. SOLO para desarrollo. ' +
    'Define JWT_SECRET en .env antes de desplegar.'
  );
  return 'kanbana_secreto_muy_largo_y_seguro_cambiar_en_produccion';
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: resolveJwtSecret(),
    });
  }

  async validate(payload: any) {
    const user = await this.usersService.findOne(payload.sub);
    if (!user || !user.activo) {
      throw new UnauthorizedException('Token inválido o usuario inactivo');
    }
    const { contrasena, ...result } = user as any;
    return result;
  }
}
