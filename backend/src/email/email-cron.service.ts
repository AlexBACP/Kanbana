/**
 * EmailCronService — Tareas programadas de notificación.
 *
 * Cron diario a las 8am hora Colombia (UTC-5 = 13:00 UTC):
 *  • Busca tickets con fecha_limite en las próximas 24 h que aún no están completados.
 *  • Envía un correo de recordatorio al aprendiz asignado.
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron }               from '@nestjs/schedule';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository, Between, Not, IsNull } from 'typeorm';
import { Ticket, TicketStatus } from '../tickets/entities/ticket.entity';
import { EmailService }       from './email.service';

@Injectable()
export class EmailCronService {
  private readonly logger = new Logger(EmailCronService.name);

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketsRepo: Repository<Ticket>,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Se ejecuta todos los días a las 8:00 AM hora Colombia (UTC-5 → 13:00 UTC).
   * Notifica a los aprendices cuya tarea vence en las próximas 24 horas.
   */
  @Cron('0 13 * * *', { timeZone: 'America/Bogota' })
  async recordatoriosPlazo(): Promise<void> {
    this.logger.log('⏰ Ejecutando cron de recordatorios de plazo…');

    const ahora  = new Date();
    const en24h  = new Date(ahora.getTime() + 24 * 60 * 60 * 1000);

    let tickets: Ticket[];
    try {
      tickets = await this.ticketsRepo.find({
        where: {
          fecha_limite:  Between(ahora, en24h) as any,
          estado:        Not(TicketStatus.DONE) as any,
          asignado_a_id: Not(IsNull()) as any,
        },
        relations: ['asignado_a', 'proyecto'],
      });
    } catch (err: any) {
      this.logger.error(`Error al consultar tickets para recordatorio: ${err.message}`);
      return;
    }

    if (!tickets.length) {
      this.logger.log('ℹ  Sin tickets próximos a vencer hoy.');
      return;
    }

    this.logger.log(`📧 Enviando recordatorio a ${tickets.length} ticket(s) próximos a vencer…`);

    for (const ticket of tickets) {
      if (!ticket.asignado_a?.correo) continue;

      const horasRestantes = Math.max(
        0,
        Math.round((ticket.fecha_limite.getTime() - ahora.getTime()) / (1000 * 60 * 60)),
      );

      await this.emailService.notificarRecordatorioPlazo({
        destinatario:   ticket.asignado_a.correo,
        aprendizNombre: ticket.asignado_a.nombre,
        tareaTitle:     ticket.titulo,
        fechaLimite:    ticket.fecha_limite,
        horasRestantes,
        proyectoNombre: (ticket as any).proyecto?.nombre ?? '',
        estado:         ticket.estado,
      });
    }

    this.logger.log('✅ Recordatorios enviados.');
  }
}
