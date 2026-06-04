import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { TicketsModule } from './tickets/tickets.module';
import { FichasModule } from './fichas/fichas.module';
import { CommentsModule } from './comments/comments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DashboardModule }  from './dashboard/dashboard.module';
import { PermisosModule }   from './permisos/permisos.module';
import { ChatModule }       from './chat/chat.module';
import { RecursosModule }   from './recursos/recursos.module';
import { GithubModule }     from './github/github.module';
import { SearchModule }     from './search/search.module';
import { IntegrationsModule } from './integrations/integrations.module';
// ── EmailModule: global (@Global), incluye ScheduleModule y cron jobs ────
import { EmailModule }      from './email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Rate limiting global: 100 requests por IP cada 60s
    // Los endpoints sensibles (login, register, contact) tienen su propio límite más estricto.
    ThrottlerModule.forRoot([{
      ttl:   60_000, // ventana de 60 segundos
      limit: 100,    // máx 100 requests por IP en esa ventana
    }]),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      username: process.env.DB_USER || 'kanbana_user',
      password: process.env.DB_PASSWORD || 'kanbana123',
      database: process.env.DB_NAME || 'kanbana_db',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      // En producción (NODE_ENV=production) synchronize=false para no alterar
      // el schema automáticamente. En desarrollo queda true para comodidad.
      synchronize: process.env.NODE_ENV !== 'production',
      logging: false,
    }),
    // EmailModule primero: es @Global y provee EmailService + ScheduleModule a todos
    EmailModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    TicketsModule,
    FichasModule,
    CommentsModule,
    NotificationsModule,
    DashboardModule,
    PermisosModule,
    ChatModule,
    RecursosModule,
    GithubModule,
    SearchModule,
    IntegrationsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Aplica ThrottlerGuard globalmente a todos los endpoints
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}