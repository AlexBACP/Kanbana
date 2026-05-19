// ── MODIFICADO ───────────────────────────────────────────────────────────────
// Cambios:
//  1. Se agrega TicketAttachment al forFeature para que TicketsService
//     pueda inyectar Repository<TicketAttachment>.
//  2. Se importa MulterModule para habilitar FileInterceptor en el controller.
//     La configuración específica de multer (storage, fileFilter, limits)
//     se define directamente en el controller con @UseInterceptors(FileInterceptor).
// ─────────────────────────────────────────────────────────────────────────────

import { Module }          from '@nestjs/common';
import { TypeOrmModule }   from '@nestjs/typeorm';
import { MulterModule }    from '@nestjs/platform-express';
import { TicketsService }   from './tickets.service';
import { TicketsController } from './tickets.controller';
import { Ticket }           from './entities/ticket.entity';
// ── NUEVO IMPORT ─────────────────────────────────────────────────────────────
import { TicketAttachment } from './entities/ticket-attachment.entity';

@Module({
  imports: [
    // ── CAMBIO: se agrega TicketAttachment al array ───────────────────────
    TypeOrmModule.forFeature([Ticket, TicketAttachment]),
    // ── NUEVO: MulterModule para habilitar FileInterceptor ────────────────
    // La config detallada (storage, fileFilter, limits) está en el controller.
    MulterModule.register({}),
  ],
  controllers: [TicketsController],
  providers:   [TicketsService],
})
export class TicketsModule {}