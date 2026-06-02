/**
 * EmailCronService — Tareas programadas de notificación.
 *
 * Crones diarios a las 8am hora Colombia (UTC-5 = 13:00 UTC):
 *
 *  1. recordatoriosPlazo   — Tickets que vencen en <24 h → notifica al aprendiz.
 *  2. notificarModulosVencidos — Módulos donde fecha_fin < hoy y no están
 *     finalizados → notifica al instructor de la ficha asociada.
 *  3. notificarModulosCompletados — Módulos donde TODAS las tareas están en
 *     "done" y el módulo no está aún finalizado → notifica al instructor.
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron }               from '@nestjs/schedule';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository, Between, Not, IsNull, LessThan } from 'typeorm';
import { Ticket, TicketStatus } from '../tickets/entities/ticket.entity';
import { Sprint }             from '../projects/entities/sprint.entity';
import { EmailService }       from './email.service';

@Injectable()
export class EmailCronService {
  private readonly logger = new Logger(EmailCronService.name);

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketsRepo: Repository<Ticket>,

    @InjectRepository(Sprint)
    private readonly sprintsRepo: Repository<Sprint>,

    private readonly emailService: EmailService,
  ) {}

  // ══════════════════════════════════════════════════════════════════════════
  // 1. RECORDATORIOS DE PLAZO DE TICKET — 8:00 AM Bogotá (13:00 UTC)
  // ══════════════════════════════════════════════════════════════════════════
  @Cron('0 13 * * *', { timeZone: 'America/Bogota' })
  async recordatoriosPlazo(): Promise<void> {
    this.logger.log('⏰ Ejecutando cron de recordatorios de plazo…');

    const ahora = new Date();
    const en24h = new Date(ahora.getTime() + 24 * 60 * 60 * 1000);

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

      try {
        await this.emailService.notificarRecordatorioPlazo({
          destinatario:   ticket.asignado_a.correo,
          aprendizNombre: ticket.asignado_a.nombre,
          tareaTitle:     ticket.titulo,
          fechaLimite:    ticket.fecha_limite,
          horasRestantes,
          proyectoNombre: (ticket as any).proyecto?.nombre ?? '',
          estado:         ticket.estado,
        });
      } catch (err: any) {
        this.logger.error(`No se pudo enviar recordatorio para ticket ${ticket.id}: ${err.message}`);
      }
    }

    this.logger.log('✅ Recordatorios de plazo enviados.');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. MÓDULOS VENCIDOS POR FECHA — 8:05 AM Bogotá (13:05 UTC)
  // Detecta módulos donde fecha_fin ya pasó y no están finalizados.
  // Notifica al instructor de la ficha del proyecto.
  // ══════════════════════════════════════════════════════════════════════════
  @Cron('5 13 * * *', { timeZone: 'America/Bogota' })
  async notificarModulosVencidos(): Promise<void> {
    this.logger.log('📅 Ejecutando cron de módulos vencidos por fecha…');

    const hoy = new Date();
    // Normalizamos a medianoche para comparar solo la fecha
    hoy.setHours(0, 0, 0, 0);

    let sprints: Sprint[];
    try {
      sprints = await this.sprintsRepo.find({
        where: {
          esta_finalizado:    false,
          pendiente_revision: false,
          fecha_fin:          LessThan(hoy) as any,
        },
        relations: [
          'proyecto',
          'proyecto.ficha',
          'proyecto.ficha.instructor',
          'tickets',
        ],
      });
    } catch (err: any) {
      this.logger.error(`Error al consultar módulos vencidos: ${err.message}`);
      return;
    }

    if (!sprints.length) {
      this.logger.log('ℹ  Sin módulos vencidos hoy.');
      return;
    }

    this.logger.log(`📧 Notificando ${sprints.length} módulo(s) vencido(s)…`);

    for (const sprint of sprints) {
      const instructor = (sprint as any).proyecto?.ficha?.instructor;
      if (!instructor?.correo) continue;

      const tickets   = (sprint as any).tickets ?? [];
      const tareasDone = tickets.filter((t: any) => t.estado === TicketStatus.DONE).length;

      try {
        await this.emailService.notificarVencimientoModulo({
          destinatario:     instructor.correo,
          instructorNombre: instructor.nombre,
          sprintNombre:     sprint.nombre,
          proyectoNombre:   (sprint as any).proyecto?.nombre ?? '',
          fechaFin:         sprint.fecha_fin,
          tareasTotal:      tickets.length,
          tareasDone,
        });
      } catch (err: any) {
        this.logger.error(`No se pudo notificar vencimiento del módulo ${sprint.id}: ${err.message}`);
      }
    }

    this.logger.log('✅ Notificaciones de módulos vencidos enviadas.');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. MÓDULOS COMPLETADOS (todas las tareas en done) — 8:10 AM Bogotá (13:10 UTC)
  // Detecta módulos activos donde todas las tareas están en "done"
  // y el instructor aún no lo ha cerrado (esta_finalizado = false).
  // Notifica al instructor para que lo revise y lo cierre.
  // ══════════════════════════════════════════════════════════════════════════
  @Cron('10 13 * * *', { timeZone: 'America/Bogota' })
  async notificarModulosCompletados(): Promise<void> {
    this.logger.log('🏁 Ejecutando cron de módulos completados por el equipo…');

    let sprints: Sprint[];
    try {
      sprints = await this.sprintsRepo.find({
        where: {
          esta_finalizado:    false,
          pendiente_revision: false,
          esta_activo:        true,
        },
        relations: [
          'proyecto',
          'proyecto.ficha',
          'proyecto.ficha.instructor',
          'tickets',
        ],
      });
    } catch (err: any) {
      this.logger.error(`Error al consultar módulos activos: ${err.message}`);
      return;
    }

    // Filtrar los que tienen ≥1 tarea y todas están en "done"
    const completados = sprints.filter(sprint => {
      const tickets = (sprint as any).tickets ?? [];
      return tickets.length > 0 && tickets.every((t: any) => t.estado === TicketStatus.DONE);
    });

    if (!completados.length) {
      this.logger.log('ℹ  Sin módulos completados al 100% hoy.');
      return;
    }

    this.logger.log(`📧 Notificando ${completados.length} módulo(s) completado(s) al instructor…`);

    for (const sprint of completados) {
      const instructor = (sprint as any).proyecto?.ficha?.instructor;
      if (!instructor?.correo) continue;

      const totalTickets = ((sprint as any).tickets ?? []).length;

      try {
        await this.emailService.notificarModuloCompletado({
          destinatario:     instructor.correo,
          instructorNombre: instructor.nombre,
          sprintNombre:     sprint.nombre,
          proyectoNombre:   (sprint as any).proyecto?.nombre ?? '',
          totalTickets,
        });
      } catch (err: any) {
        this.logger.error(`No se pudo notificar módulo completado ${sprint.id}: ${err.message}`);
      }
    }

    this.logger.log('✅ Notificaciones de módulos completados enviadas.');
  }
}
