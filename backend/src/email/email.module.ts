import { Global, Module }    from '@nestjs/common';
import { ScheduleModule }    from '@nestjs/schedule';
import { TypeOrmModule }     from '@nestjs/typeorm';
import { EmailService }      from './email.service';
import { EmailCronService }  from './email-cron.service';
import { Ticket }            from '../tickets/entities/ticket.entity';

/**
 * EmailModule — global para que EmailService esté disponible
 * en todos los módulos sin necesidad de importarlo explícitamente.
 */
@Global()
@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Ticket]),
  ],
  providers: [EmailService, EmailCronService],
  exports:   [EmailService],
})
export class EmailModule {}
