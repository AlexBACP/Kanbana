import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { GithubModule } from '../github/github.module';
import { Ficha } from '../fichas/entities/ficha.entity';

// ── Resolver el secret a tiempo de registro ────────────────────────────────
// Misma lógica que en jwt.strategy.ts: requerido en producción, con aviso
// en desarrollo cuando se usa el fallback.
const resolveJwtSecret = (): string => {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv && fromEnv.length >= 16) return fromEnv;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET es obligatorio en producción (mínimo 16 caracteres). ' +
      'Defínelo en las variables de entorno antes de iniciar el servidor.'
    );
  }
  return 'kanbana_secreto_muy_largo_y_seguro_cambiar_en_produccion';
};

@Module({
  imports: [
    UsersModule,
    NotificationsModule,
    GithubModule,
    TypeOrmModule.forFeature([Ficha]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: resolveJwtSecret(),
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
