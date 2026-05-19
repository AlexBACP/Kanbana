import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermisosController } from './permisos.controller';
import { PermisosService }    from './permisos.service';
import { PermisoTemporal }    from './entities/permiso-temporal.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule }         from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PermisoTemporal]),
    NotificationsModule,
    UsersModule,
  ],
  controllers: [PermisosController],
  providers:   [PermisosService],
  exports:     [PermisosService],
})
export class PermisosModule {}