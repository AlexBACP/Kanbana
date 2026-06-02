import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { Notification } from './entities/notification.entity';
import { IntegrationsModule } from '../integrations/integrations.module';
import { KanbanGateway } from './kanban.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([Notification]), IntegrationsModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, KanbanGateway],
  exports: [NotificationsService, KanbanGateway],
})
export class NotificationsModule {}
