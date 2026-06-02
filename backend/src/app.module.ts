import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
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
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      username: process.env.DB_USER || 'kanbana_user',
      password: process.env.DB_PASSWORD || 'kanbana123',
      database: process.env.DB_NAME || 'kanbana_db',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true, // set false in production
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
  providers: [AppService],
})
export class AppModule {}