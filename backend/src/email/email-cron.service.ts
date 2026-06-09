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
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class EmailCronService {
  private readonly logger = new Logger(EmailCronService.name);

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketsRepo: Repository<Ticket>,

    @InjectRepository(Sprint)
    private readonly sprintsRepo: Repository<Sprint>,

    private readonly emailService:        EmailService,
    private readonly notificationsService: NotificationsService,
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
        // Cargamos también al líder técnico del proyecto para avisarle.
        relations: ['asignado_a', 'proyecto', 'proyecto.lider'],
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
      const horasRestantes = Math.max(
        0,
        Math.round((ticket.fecha_limite.getTime() - ahora.getTime()) / (1000 * 60 * 60)),
      );
      const proyectoNombre = (ticket as any).proyecto?.nombre ?? '';

      // ── 1) Email al aprendiz asignado ──────────────────────────────────
      if (ticket.asignado_a?.correo) {
        try {
          await this.emailService.notificarRecordatorioPlazo({
            destinatario:   ticket.asignado_a.correo,
            aprendizNombre: ticket.asignado_a.nombre,
            tareaTitle:     ticket.titulo,
            fechaLimite:    ticket.fecha_limite,
            horasRestantes,
            proyectoNombre,
            estado:         ticket.estado,
          });
        } catch (err: any) {
          this.logger.error(`No se pudo enviar recordatorio al aprendiz (ticket ${ticket.id}): ${err.message}`);
        }
      }

      // ── 2) Email al líder técnico del proyecto (si es distinto del asignado) ──
      const lider = (ticket as any).proyecto?.lider;
      if (lider?.correo && lider.id !== ticket.asignado_a_id) {
        try {
          await this.emailService.notificarRecordatorioPlazo({
            destinatario:   lider.correo,
            aprendizNombre: lider.nombre,
            tareaTitle:     `[Equipo] ${ticket.titulo}`,
            fechaLimite:    ticket.fecha_limite,
            horasRestantes,
            proyectoNombre,
            estado:         ticket.estado,
          });
        } catch (err: any) {
          this.logger.error(`No se pudo enviar recordatorio al líder (ticket ${ticket.id}): ${err.message}`);
        }
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
          'proyecto.lider',
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

    this.logger.log(`📧 Notificando ${completados.length} módulo(s) completado(s)…`);

    for (const sprint of completados) {
      const proyectoNombre = (sprint as any).proyecto?.nombre ?? '';
      const totalTickets   = ((sprint as any).tickets ?? []).length;

      // ── 1) Instructor de la ficha ─────────────────────────────────────
      const instructor = (sprint as any).proyecto?.ficha?.instructor;
      if (instructor?.correo) {
        try {
          await this.emailService.notificarModuloCompletado({
            destinatario:     instructor.correo,
            instructorNombre: instructor.nombre,
            sprintNombre:     sprint.nombre,
            proyectoNombre,
            totalTickets,
          });
        } catch (err: any) {
          this.logger.error(`No se pudo notificar al instructor del módulo ${sprint.id}: ${err.message}`);
        }
      }

      // ── 2) Líder técnico del proyecto (si es distinto del instructor) ──
      const lider = (sprint as any).proyecto?.lider;
      if (lider?.correo && lider.id !== instructor?.id) {
        try {
          await this.emailService.notificarModuloCompletado({
            destinatario:     lider.correo,
            instructorNombre: lider.nombre,
            sprintNombre:     sprint.nombre,
            proyectoNombre,
            totalTickets,
          });
        } catch (err: any) {
          this.logger.error(`No se pudo notificar al líder del módulo ${sprint.id}: ${err.message}`);
        }
      }
    }

    this.logger.log('✅ Notificaciones de módulos completados enviadas.');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 5. MÓDULOS PRÓXIMOS A VENCER — 8:15 AM Bogotá
  // Detecta módulos cuya fecha_fin está entre hoy y dentro de 3 días,
  // no finalizados ni en revisión. Notifica al líder técnico del proyecto
  // (y también al instructor, por si acaso).
  // ══════════════════════════════════════════════════════════════════════════
  @Cron('15 13 * * *', { timeZone: 'America/Bogota' })
  async notificarModulosProximosAVencer(): Promise<void> {
    this.logger.log('🟡 Ejecutando cron de módulos próximos a vencer…');

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const en3dias = new Date(hoy.getTime() + 3 * 24 * 60 * 60 * 1000);

    let sprints: Sprint[];
    try {
      sprints = await this.sprintsRepo.find({
        where: {
          esta_finalizado:    false,
          pendiente_revision: false,
          fecha_fin:          Between(hoy, en3dias) as any,
        },
        relations: [
          'proyecto',
          'proyecto.ficha',
          'proyecto.ficha.instructor',
          'proyecto.lider',
          'tickets',
        ],
      });
    } catch (err: any) {
      this.logger.error(`Error al consultar módulos próximos a vencer: ${err.message}`);
      return;
    }

    if (!sprints.length) {
      this.logger.log('ℹ  Sin módulos próximos a vencer.');
      return;
    }

    this.logger.log(`📧 Notificando ${sprints.length} módulo(s) próximos a vencer…`);

    for (const sprint of sprints) {
      const tickets        = (sprint as any).tickets ?? [];
      const tareasDone     = tickets.filter((t: any) => t.estado === TicketStatus.DONE).length;
      const proyectoNombre = (sprint as any).proyecto?.nombre ?? '';
      const instructor     = (sprint as any).proyecto?.ficha?.instructor;
      const lider          = (sprint as any).proyecto?.lider;

      // ── Líder técnico (principal destinatario) ────────────────────────
      if (lider?.correo) {
        try {
          await this.emailService.notificarVencimientoModulo({
            destinatario:     lider.correo,
            instructorNombre: lider.nombre,
            sprintNombre:     sprint.nombre,
            proyectoNombre,
            fechaFin:         sprint.fecha_fin,
            tareasTotal:      tickets.length,
            tareasDone,
          });
        } catch (err: any) {
          this.logger.error(`No se pudo notificar al líder del módulo próximo ${sprint.id}: ${err.message}`);
        }
      }

      // ── Instructor (también, si es distinto del líder) ────────────────
      if (instructor?.correo && instructor.id !== lider?.id) {
        try {
          await this.emailService.notificarVencimientoModulo({
            destinatario:     instructor.correo,
            instructorNombre: instructor.nombre,
            sprintNombre:     sprint.nombre,
            proyectoNombre,
            fechaFin:         sprint.fecha_fin,
            tareasTotal:      tickets.length,
            tareasDone,
          });
        } catch (err: any) {
          this.logger.error(`No se pudo notificar al instructor del módulo próximo ${sprint.id}: ${err.message}`);
        }
      }
    }

    this.logger.log('✅ Notificaciones de módulos próximos a vencer enviadas.');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 4. DETECTAR TAREAS VENCIDAS — corre 3 veces al día (8am, 1pm, 6pm Bogotá)
  // ══════════════════════════════════════════════════════════════════════════
  @Cron('0 13,18,23 * * *', { timeZone: 'UTC' })
  async detectarTareasVencidas(): Promise<void> {
    this.logger.log('🔴 Ejecutando cron de tareas vencidas…');
    const ahora = new Date();

    let vencidas: Ticket[];
    try {
      vencidas = await this.ticketsRepo.find({
        where: {
          fecha_limite: LessThan(ahora) as any,
          estado:       Not(TicketStatus.DONE) as any,
          vencida:      false,
        },
        relations: ['asignado_a', 'proyecto', 'proyecto.lider'],
      });
    } catch (err: any) {
      this.logger.error(`Error consultando tareas vencidas: ${err.message}`);
      return;
    }

    if (vencidas.length === 0) {
      this.logger.log('ℹ  Sin tareas vencidas nuevas.');
      return;
    }

    this.logger.log(`📌 Marcando ${vencidas.length} tarea(s) como vencidas…`);

    for (const ticket of vencidas) {
      try {
        // Marcar como vencida
        await this.ticketsRepo.update(ticket.id, { vencida: true });

        const ad = JSON.stringify({ ticket_id: ticket.id, proyecto_id: ticket.proyecto_id });

        // Notificar al asignado
        if (ticket.asignado_a_id) {
          await this.notificationsService.create({
            usuario_id:  ticket.asignado_a_id,
            titulo:      `⏰ Tarea vencida: "${ticket.titulo}"`,
            mensaje:     `La fecha límite de "${ticket.titulo}" ya pasó. Revísala y actualízala lo antes posible.`,
            tipo:        'warning' as any,
            action_data: ad,
          });
        }

        // Notificar al líder técnico del proyecto (si existe y es distinto al asignado)
        const lider = (ticket as any).proyecto?.lider;
        if (lider?.id && lider.id !== ticket.asignado_a_id) {
          await this.notificationsService.create({
            usuario_id:  lider.id,
            titulo:      `⏰ Tarea de tu equipo vencida: "${ticket.titulo}"`,
            mensaje:     `Una tarea de tu equipo ya pasó su fecha límite. Coordina con el aprendiz para destrabarla.`,
            tipo:        'warning' as any,
            action_data: ad,
          });
        }
      } catch (err: any) {
        this.logger.error(`Error procesando tarea vencida ${ticket.id}: ${err.message}`);
      }
    }

    this.logger.log('✅ Notificaciones de tareas vencidas enviadas.');
  }
}
