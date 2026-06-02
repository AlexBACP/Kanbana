import { Global, Module }    from '@nestjs/common';
import { ScheduleModule }    from '@nestjs/schedule';
import { TypeOrmModule }     from '@nestjs/typeorm';
import { EmailService }      from './email.service';
import { EmailCronService }  from './email-cron.service';
import { BounceCheckerService }    from './bounce-checker.service';
import { BounceCheckerController } from './bounce-checker.controller';
import { Ticket }            from '../tickets/entities/ticket.entity';
import { Sprint }            from '../projects/entities/sprint.entity';
import { User }              from '../users/entities/user.entity';
import { Ficha }             from '../fichas/entities/ficha.entity';
import { NotificationsModule } from '../notifications/notifications.module';

/**
 * EmailModule — global para que EmailService esté disponible
 * en todos los módulos sin necesidad de importarlo explícitamente.
 */
@Global()
@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Ticket, Sprint, User, Ficha]),
    NotificationsModule,
  ],
  controllers: [BounceCheckerController],
  providers: [EmailService, EmailCronService, BounceCheckerService],
  exports:   [EmailService, BounceCheckerService],
})
export class EmailModule {}
