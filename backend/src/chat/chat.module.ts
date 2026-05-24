import { Module }             from '@nestjs/common';
import { TypeOrmModule }      from '@nestjs/typeorm';
import { ChatController }     from './chat.controller';
import { ChatService }        from './chat.service';
import { ProjectsModule }     from '../projects/projects.module';
import { TicketsModule }      from '../tickets/tickets.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Ticket }             from '../tickets/entities/ticket.entity';
import { TicketAttachment }   from '../tickets/entities/ticket-attachment.entity';
import { TicketsService }     from '../tickets/tickets.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ticket, TicketAttachment]),
    ProjectsModule,
    // NotificationsModule exporta NotificationsService, que TicketsService necesita
    NotificationsModule,
  ],
  controllers: [ChatController],
  providers:   [ChatService, TicketsService],
})
export class ChatModule {}
