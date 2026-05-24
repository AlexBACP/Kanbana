// ── MODIFICADO ───────────────────────────────────────────────────────────────
// Cambios respecto a la versión original:
//
//  1. Se inyecta Repository<TicketAttachment> para gestionar adjuntos.
//
//  2. findOne(): ahora incluye 'adjuntos' y 'adjuntos.subido_por' en relations,
//     para que el frontend pueda mostrar la galería de archivos.
//
//  3. updateStatus(): ahora verifica que si requiere_adjunto === true,
//     el ticket tenga al menos un adjunto antes de permitir pasar a 'done'.
//     Esta es LA validación central de la condición de completitud.
//
//  4. create(): si el ticket pertenece a un sprint cuyo trimestre es
//     'documental', setea requiere_adjunto = true automáticamente.
//     Para esto necesita hacer un JOIN con sprint → trimestre.
//
//  5. NUEVOS métodos:
//     - uploadAttachment(): guarda el registro del archivo en BD.
//     - findAttachments(): lista los adjuntos de un ticket.
//     - deleteAttachment(): borra el registro y el archivo del disco.
// ─────────────────────────────────────────────────────────────────────────────

import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs   from 'fs';
import * as path from 'path';

import { Ticket, TicketStatus }   from './entities/ticket.entity';
import { TicketAttachment }        from './entities/ticket-attachment.entity';
import { TipoTrimestre }           from '../projects/entities/trimestre.entity';
import { NotificationsService }    from '../notifications/notifications.service';
import { EmailService }            from '../email/email.service';

// Mapas de etiquetas para notificaciones
const ESTADO_LABEL: Record<string, string> = {
  to_do:       'Por hacer',
  in_progress: 'En progreso',
  testing:     'Testing / Revisión',
  done:        'Completada ✅',
};

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private ticketsRepository: Repository<Ticket>,
    @InjectRepository(TicketAttachment)
    private attachmentsRepo: Repository<TicketAttachment>,
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService,
  ) {}

  // ── MODIFICADO: detecta si el ticket debe requerir adjunto ───────────────
  // Regla: si el ticket se crea dentro de un sprint de un trimestre documental,
  // requiere_adjunto se activa automáticamente.
  async create(createTicketDto: any): Promise<Ticket> {
    let requiere_adjunto = createTicketDto.requiere_adjunto ?? false;

    // Si el ticket tiene sprint_id, verificar si ese sprint es de un
    // trimestre documental para activar requiere_adjunto automáticamente.
    if (createTicketDto.sprint_id && !requiere_adjunto) {
      const sprint = await this.ticketsRepository.manager
        .getRepository('sprints')
        .findOne({
          where:     { id: createTicketDto.sprint_id },
          // Cargar el trimestre para ver su tipo
          relations: ['trimestre'],
        });

      if (sprint?.trimestre?.tipo === TipoTrimestre.DOCUMENTAL) {
        // ── REGLA: sprint en trimestre documental → adjunto obligatorio ──
        requiere_adjunto = true;
      }
    }

    const ticket = this.ticketsRepository.create({
      ...createTicketDto,
      requiere_adjunto,
    });
    const saved = await this.ticketsRepository.save(ticket as any) as any;

    // Notificar al aprendiz asignado (si hay uno y no es quien la creó)
    if (
      saved.asignado_a_id &&
      saved.asignado_a_id !== createTicketDto.creado_por_id
    ) {
      // Cargamos el ticket completo con relaciones para in-app + email
      const full = await this.ticketsRepository.findOne({
        where:     { id: saved.id },
        relations: ['proyecto', 'creado_por', 'asignado_a', 'sprint'],
      });
      const creadorNombre = full?.creado_por?.nombre ?? 'Tu líder';

      // In-app
      await this.notificationsService.create({
        usuario_id: saved.asignado_a_id,
        titulo:     `Nueva tarea asignada: "${saved.titulo}"`,
        mensaje:    `${creadorNombre} te asignó la tarea "${saved.titulo}" en el proyecto "${(full as any)?.proyecto?.nombre ?? ''}"`,
        tipo:       'info' as any,
      });

      // Email
      if ((full as any)?.asignado_a?.correo) {
        await this.emailService.notificarTareaAsignada({
          destinatario:   (full as any).asignado_a.correo,
          aprendizNombre: (full as any).asignado_a.nombre,
          tareaTitle:     saved.titulo,
          descripcion:    saved.descripcion,
          prioridad:      saved.prioridad,
          fechaLimite:    saved.fecha_limite ?? undefined,
          proyectoNombre: (full as any)?.proyecto?.nombre ?? '',
          sprintNombre:   (full as any)?.sprint?.nombre,
          asignadoPor:    creadorNombre,
        });
      }
    }

    return saved;
  }

  async findAll(
    proyecto_id?: number,
    sprint_id?:   number,
    backlog?:     boolean,
  ): Promise<Ticket[]> {
    const where: any = {};
    if (proyecto_id) where.proyecto_id = proyecto_id;
    if (sprint_id)   where.sprint_id   = sprint_id;
    if (backlog)     where.sprint_id   = null;

    return this.ticketsRepository.find({
      where,
      relations: ['asignado_a', 'creado_por', 'subtareas'],
    });
  }

  // ── MODIFICADO: incluye adjuntos en la carga del ticket ──────────────────
  async findOne(id: number): Promise<Ticket> {
    return this.ticketsRepository.findOne({
      where: { id },
      relations: [
        'proyecto',
        'asignado_a',
        'creado_por',
        'comentarios',
        'comentarios.usuario',
        'subtareas',
        'ticket_padre',
        // ── NUEVO: cargar adjuntos con quien los subió ────────────────
        'adjuntos',
        'adjuntos.subido_por',
      ],
    });
  }

  // ── MODIFICADO: validación de adjunto obligatorio antes de marcar done ────
  // Esta es la validación más importante de toda la funcionalidad:
  // si el ticket requiere adjunto y no tiene ninguno, el sistema rechaza
  // el cambio a 'done' con un error claro.
  // actor = req.user (del JWT) — identifica QUIÉN realizó el cambio de estado.
  // Si no se pasa (llamadas internas), se cae al creador del ticket como fallback.
  async updateStatus(id: number, statusDto: any, actor?: any): Promise<Ticket> {
    const ticket = await this.ticketsRepository.findOne({
      where:     { id },
      // ── NUEVO: cargar adjuntos para validar ───────────────────────
      relations: ['adjuntos'],
    });
    if (!ticket) throw new NotFoundException('Ticket no encontrado');

    // ── Validación de adjunto obligatorio ────────────────────────────────
    if (
      statusDto.estado === TicketStatus.DONE &&
      ticket.requiere_adjunto &&
      (!ticket.adjuntos || ticket.adjuntos.length === 0)
    ) {
      throw new BadRequestException(
        `El ticket "${ticket.titulo}" requiere al menos un archivo adjunto ` +
        `(documento, imagen o ZIP) para poderse marcar como completado. ` +
        `Sube el archivo en la sección "Adjuntos" del ticket.`
      );
    }

    // ── Validación de bloqueo (existente, mantenida) ─────────────────────
    if (statusDto.estado === TicketStatus.DONE && ticket.esta_bloqueado) {
      throw new BadRequestException(
        `El ticket "${ticket.titulo}" está bloqueado: "${ticket.motivo_bloqueo}". ` +
        `Resuelve el bloqueo antes de marcarlo como completado.`
      );
    }

    await this.ticketsRepository.update(id, {
      estado:         statusDto.estado,
      actualizado_en: new Date(),
    });

    // ── Notificaciones por cambio de estado ──────────────────────────────────
    // Recargar con relaciones para obtener nombres
    const updated = await this.ticketsRepository.findOne({
      where: { id },
      relations: ['asignado_a', 'creado_por', 'proyecto'],
    });

    if (updated) {
      const estadoLabel = ESTADO_LABEL[statusDto.estado] ?? statusDto.estado;
      const titulo      = updated.titulo;
      const proyecto    = (updated as any).proyecto?.nombre ?? '';

      // El actor es quien llamó al endpoint (req.user).
      // Fallback: nombre del creador si no hay actor (llamada interna sin auth).
      const actorId     = actor?.id ?? null;
      const actorNombre = actor?.nombre ?? (updated as any).creado_por?.nombre ?? 'Alguien';

      // Tarea completada → notificar al creador/líder (si no fue él mismo quien la completó)
      if (statusDto.estado === TicketStatus.DONE) {
        if (updated.creado_por_id && updated.creado_por_id !== actorId) {
          await this.notificationsService.create({
            usuario_id: updated.creado_por_id,
            titulo:     `Tarea completada: "${titulo}"`,
            mensaje:    `${actorNombre} marcó como completada la tarea "${titulo}" en "${proyecto}".`,
            tipo:       'success' as any,
          });
        }
      }

      // Tarea en testing → notificar al creador/líder para que revise
      if (statusDto.estado === TicketStatus.TESTING) {
        if (updated.creado_por_id && updated.creado_por_id !== actorId) {
          await this.notificationsService.create({
            usuario_id: updated.creado_por_id,
            titulo:     `Tarea lista para revisión: "${titulo}"`,
            mensaje:    `${actorNombre} movió "${titulo}" a Testing. Revísala en el tablero.`,
            tipo:       'info' as any,
          });
        }
      }

      // Otros cambios de estado → notificar al asignado si el actor es alguien distinto
      if (
        statusDto.estado !== TicketStatus.DONE &&
        statusDto.estado !== TicketStatus.TESTING &&
        (updated as any).asignado_a?.id
      ) {
        if ((updated as any).asignado_a.id !== actorId) {
          await this.notificationsService.create({
            usuario_id: (updated as any).asignado_a.id,
            titulo:     `Estado actualizado: "${titulo}"`,
            mensaje:    `${actorNombre} cambió el estado de "${titulo}" a "${estadoLabel}".`,
            tipo:       'info' as any,
          });
        }
      }
    }

    return this.findOne(id);
  }

  async update(id: number, updateTicketDto: any): Promise<Ticket> {
    // Antes de actualizar, capturamos el asignado anterior
    const antes = await this.ticketsRepository.findOne({
      where:     { id },
      relations: ['creado_por', 'proyecto'],
    });

    await this.ticketsRepository.update(id, updateTicketDto);

    // Si se está cambiando el asignado → notificar al nuevo responsable
    if (
      updateTicketDto.asignado_a_id !== undefined &&
      updateTicketDto.asignado_a_id !== null &&
      updateTicketDto.asignado_a_id !== (antes as any)?.asignado_a_id
    ) {
      const full = await this.ticketsRepository.findOne({
        where:     { id },
        relations: ['proyecto', 'creado_por', 'asignado_a', 'sprint'],
      });
      const asignadorNombre = full?.creado_por?.nombre ?? 'Tu líder técnico';

      // In-app
      await this.notificationsService.create({
        usuario_id: updateTicketDto.asignado_a_id,
        titulo:     `Nueva tarea asignada: "${antes?.titulo}"`,
        mensaje:    `${asignadorNombre} te asignó la tarea "${antes?.titulo}" en el proyecto "${(full as any)?.proyecto?.nombre ?? ''}".`,
        tipo:       'info' as any,
      });

      // Email
      if ((full as any)?.asignado_a?.correo) {
        await this.emailService.notificarTareaAsignada({
          destinatario:   (full as any).asignado_a.correo,
          aprendizNombre: (full as any).asignado_a.nombre,
          tareaTitle:     antes?.titulo ?? '',
          descripcion:    antes?.descripcion ?? undefined,
          prioridad:      antes?.prioridad ?? 'media',
          fechaLimite:    antes?.fecha_limite ?? undefined,
          proyectoNombre: (full as any)?.proyecto?.nombre ?? '',
          sprintNombre:   (full as any)?.sprint?.nombre,
          asignadoPor:    asignadorNombre,
        });
      }
    }

    return this.findOne(id);
  }

  async moveTask(ticketId: number, sprintId: number | null): Promise<Ticket> {
    await this.ticketsRepository.update(ticketId, { sprint_id: sprintId });
    return this.findOne(ticketId);
  }

  async setFlag(
    ticketId: number,
    flagDto: { isBlocked: boolean; reason?: string },
  ): Promise<Ticket> {
    await this.ticketsRepository.update(ticketId, {
      esta_bloqueado: flagDto.isBlocked,
      motivo_bloqueo: flagDto.reason,
    });
    return this.findOne(ticketId);
  }

  async remove(id: number): Promise<void> {
    // Los adjuntos se borran en cascada por la FK en ticket_attachments,
    // pero también borramos los archivos físicos del disco.
    const adjuntos = await this.attachmentsRepo.find({ where: { ticket_id: id } });
    for (const adj of adjuntos) {
      this.eliminarArchivoDisco(adj.nombre_disco);
    }
    await this.ticketsRepository.delete(id);
  }

  // ══ NUEVOS MÉTODOS: gestión de adjuntos ═══════════════════════════════════

  // Guarda el registro de un archivo recién subido por Multer.
  // Este método lo llama el controller DESPUÉS de que Multer ya guardó
  // el archivo en /uploads/attachments/<nombre_disco>.
  async uploadAttachment(
    ticketId:   number,
    file:       Express.Multer.File,
    subido_por_id: number,
  ): Promise<TicketAttachment> {
    const ticket = await this.ticketsRepository.findOne({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket no encontrado');

    // La URL pública que el frontend usará para descargar el archivo.
    // Funciona gracias a useStaticAssets() en main.ts.
    const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000';
    const url     = `${baseUrl}/uploads/attachments/${file.filename}`;

    const attachment = this.attachmentsRepo.create({
      ticket_id:      ticketId,
      nombre_original: file.originalname,
      nombre_disco:    file.filename,
      url,
      tipo_mime:       file.mimetype,
      tamano_bytes:    file.size,
      subido_por_id,
    });

    return this.attachmentsRepo.save(attachment);
  }

  // Lista todos los adjuntos de un ticket, ordenados del más reciente al más antiguo.
  async findAttachments(ticketId: number): Promise<TicketAttachment[]> {
    return this.attachmentsRepo.find({
      where:     { ticket_id: ticketId },
      relations: ['subido_por'],
      order:     { creado_en: 'DESC' },
    });
  }

  // Borra un adjunto: primero el archivo del disco, luego el registro en BD.
  // Solo el usuario que subió el archivo o un instructor/coordinador puede borrarlo.
  async deleteAttachment(attachmentId: number): Promise<{ message: string }> {
    const attachment = await this.attachmentsRepo.findOne({
      where: { id: attachmentId },
    });
    if (!attachment) throw new NotFoundException('Adjunto no encontrado');

    // Borrar el archivo físico del disco
    this.eliminarArchivoDisco(attachment.nombre_disco);

    // Borrar el registro de la BD
    await this.attachmentsRepo.delete(attachmentId);

    return { message: `Adjunto "${attachment.nombre_original}" eliminado correctamente.` };
  }

  // ══ NUEVOS MÉTODOS: flujo de reclamación y revisión ══════════════════════

  // Aprendiz reclama una tarea disponible (to_do, sin asignar).
  // La mueve automáticamente a in_progress y notifica al líder.
  async claimTicket(ticketId: number, userId: number): Promise<Ticket> {
    const ticket = await this.ticketsRepository.findOne({
      where:     { id: ticketId },
      relations: ['creado_por', 'proyecto'],
    });
    if (!ticket) throw new NotFoundException('Ticket no encontrado');
    if (ticket.asignado_a_id) {
      throw new BadRequestException('Esta tarea ya fue tomada por otro aprendiz.');
    }
    if (ticket.estado !== TicketStatus.TODO) {
      throw new BadRequestException('Solo se pueden tomar tareas en estado "Por hacer".');
    }

    await this.ticketsRepository.update(ticketId, {
      asignado_a_id: userId,
      estado:        TicketStatus.IN_PROGRESS,
    });

    // Notificar al líder (creador) que alguien tomó la tarea
    const full = await this.ticketsRepository.findOne({
      where:     { id: ticketId },
      relations: ['asignado_a', 'proyecto'],
    });
    if (ticket.creado_por_id && ticket.creado_por_id !== userId) {
      await this.notificationsService.create({
        usuario_id: ticket.creado_por_id,
        titulo:  `Tarea tomada: "${ticket.titulo}"`,
        mensaje: `${full?.asignado_a?.nombre ?? 'Un aprendiz'} tomó la tarea "${ticket.titulo}" en "${(full as any)?.proyecto?.nombre ?? ''}".`,
        tipo:    'info' as any,
      });
    }

    return this.findOne(ticketId);
  }

  // Aprendiz indica que terminó su trabajo → activa la bandera de revisión.
  // La tarea sigue en in_progress pero la tarjeta se vuelve verde en el tablero.
  async markCompleteByAprendiz(ticketId: number, userId: number): Promise<Ticket> {
    const ticket = await this.ticketsRepository.findOne({
      where:     { id: ticketId },
      relations: ['creado_por', 'proyecto'],
    });
    if (!ticket) throw new NotFoundException('Ticket no encontrado');
    if (ticket.asignado_a_id !== userId) {
      throw new ForbiddenException('Solo el aprendiz asignado puede marcar esta tarea como completada.');
    }

    await this.ticketsRepository.update(ticketId, { completado_por_aprendiz: true });

    // Notificar al líder para que revise
    if (ticket.creado_por_id && ticket.creado_por_id !== userId) {
      // Cargar datos extras para el email
      const full = await this.ticketsRepository.findOne({
        where:     { id: ticketId },
        relations: ['asignado_a', 'proyecto', 'creado_por', 'sprint'],
      });

      // In-app
      await this.notificationsService.create({
        usuario_id: ticket.creado_por_id,
        titulo:  `Tarea lista para tu revisión: "${ticket.titulo}"`,
        mensaje: `Un aprendiz completó el trabajo en "${ticket.titulo}". Revísala en el tablero y aprueba o devuelve.`,
        tipo:    'success' as any,
      });

      // Email al líder
      if ((full as any)?.creado_por?.correo) {
        await this.emailService.notificarTareaCompletadaPorAprendiz({
          destinatario:   (full as any).creado_por.correo,
          liderNombre:    (full as any).creado_por.nombre,
          aprendizNombre: (full as any)?.asignado_a?.nombre ?? 'Un aprendiz',
          tareaTitle:     ticket.titulo,
          proyectoNombre: (full as any)?.proyecto?.nombre ?? '',
          sprintNombre:   (full as any)?.sprint?.nombre,
        });
      }
    }

    return this.findOne(ticketId);
  }

  // Líder aprueba el trabajo → la tarea pasa a testing (visible para instructor).
  async liderApprove(ticketId: number): Promise<Ticket> {
    const ticket = await this.ticketsRepository.findOne({
      where:     { id: ticketId },
      relations: ['asignado_a', 'proyecto'],
    });
    if (!ticket) throw new NotFoundException('Ticket no encontrado');

    await this.ticketsRepository.update(ticketId, {
      completado_por_aprendiz: false,
      estado:                  TicketStatus.TESTING,
    });

    // Notificar al aprendiz que su trabajo fue aprobado
    if (ticket.asignado_a_id) {
      // In-app
      await this.notificationsService.create({
        usuario_id: ticket.asignado_a_id,
        titulo:  `¡Trabajo aprobado! "${ticket.titulo}"`,
        mensaje: `Tu líder aprobó tu trabajo en "${ticket.titulo}". La tarea pasó a revisión del instructor.`,
        tipo:    'success' as any,
      });

      // Email al aprendiz
      if ((ticket as any)?.asignado_a?.correo) {
        await this.emailService.notificarTareaAprobada({
          destinatario:   (ticket as any).asignado_a.correo,
          aprendizNombre: (ticket as any).asignado_a.nombre,
          tareaTitle:     ticket.titulo,
          proyectoNombre: (ticket as any)?.proyecto?.nombre ?? '',
        });
      }
    }

    return this.findOne(ticketId);
  }

  // Líder rechaza el trabajo → devuelve la tarea al pool (to_do, sin asignar).
  async liderReject(ticketId: number): Promise<Ticket> {
    const ticket = await this.ticketsRepository.findOne({
      where:     { id: ticketId },
      relations: ['asignado_a', 'proyecto'],
    });
    if (!ticket) throw new NotFoundException('Ticket no encontrado');

    const prevAsignado = ticket.asignado_a_id;

    await this.ticketsRepository.update(ticketId, {
      completado_por_aprendiz: false,
      estado:                  TicketStatus.TODO,
      asignado_a_id:           null as any,
    });

    // Notificar al aprendiz que debe corregir
    if (prevAsignado) {
      // In-app
      await this.notificationsService.create({
        usuario_id: prevAsignado,
        titulo:  `Trabajo devuelto: "${ticket.titulo}"`,
        mensaje: `Tu líder necesita correcciones en "${ticket.titulo}". La tarea regresó al pool — revisa los comentarios.`,
        tipo:    'warning' as any,
      });

      // Email al aprendiz
      if ((ticket as any)?.asignado_a?.correo) {
        await this.emailService.notificarTareaDevuelta({
          destinatario:   (ticket as any).asignado_a.correo,
          aprendizNombre: (ticket as any).asignado_a.nombre,
          tareaTitle:     ticket.titulo,
          proyectoNombre: (ticket as any)?.proyecto?.nombre ?? '',
        });
      }
    }

    return this.findOne(ticketId);
  }

  // Helper privado: borra el archivo del sistema de archivos sin lanzar error
  // si el archivo ya no existe (puede haber sido borrado manualmente).
  private eliminarArchivoDisco(nombreDisco: string): void {
    try {
      const filePath = path.join(process.cwd(), 'uploads', 'attachments', nombreDisco);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // No lanzar error si el archivo no existe — simplemente continuar
    }
  }
}