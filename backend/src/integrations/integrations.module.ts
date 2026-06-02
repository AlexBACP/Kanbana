import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from '../tickets/entities/ticket.entity';
import { N8nService } from './n8n.service';
import { IntegrationsController } from './integrations.controller';

/**
 * IntegrationsModule — Integraciones externas vía n8n.
 *
 * Exporta N8nService para que otros módulos (p.ej. NotificationsModule)
 * puedan emitir eventos salientes hacia n8n.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Ticket])],
  controllers: [IntegrationsController],
  providers: [N8nService],
  exports: [N8nService],
})
export class IntegrationsModule {}
