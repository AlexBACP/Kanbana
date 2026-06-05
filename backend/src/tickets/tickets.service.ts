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
import { TipoTrimestre, EstadoTrimestre, Trimestre } from '../projects/entities/trimestre.entity';
import { Sprint }                  from '../projects/entities/sprint.entity';
import { NotificationsService }    from '../notifications/notifications.service';
import { EmailService }            from '../email/email.service';
import { KanbanGateway }           from '../notifications/kanban.gateway';

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
    private readonly gateway: KanbanGateway,
  ) {}

  /**
   * Genera un código de referencia único de 5 dígitos (10000-99999).
   * Reintenta hasta 10 veces si colisiona (extremadamente improbable con 90.000 espacios).
   */
  private async generateCodigoReferencia(): Promise<number> {
    for (let i = 0; i < 10; i++) {
      const candidate = Math.floor(10000 + Math.random() * 90000);
      const exists = await this.ticketsRepository.findOne({
        where: { codigo_referencia: candidate },
      });
      if (!exists) return candidate;
    }
    // Fallback en el caso casi imposible: timestamp últimos 5 dígitos
    return Math.floor(Date.now() % 90000) + 10000;
  }

  // ── MODIFICADO: detecta si el ticket debe requerir adjunto ───────────────
  // Regla: si el ticket se crea dentro de un sprint de un trimestre documental,
  // requiere_adjunto se activa automáticamente.
  async create(createTicketDto: any, actor?: any): Promise<Ticket> {
    // ── Validación: el líder técnico solo puede crear tareas en SU proyecto ──
    // Coordinador e instructor no tienen esta restricción aquí (el frontend
    // ya filtra qué proyectos ven, pero podríamos endurecerlo más adelante).
    if (actor && actor.rol === 'aprendiz' && actor.es_lider_tecnico === true) {
      if (!createTicketDto.proyecto_id) {
        throw new BadRequestException('Falta el proyecto al crear la tarea.');
      }
      const proyectoId = Number(createTicketDto.proyecto_id);
      const actorId    = Number(actor.id);

      const proyecto = await this.ticketsRepository.manager
        .getRepository('Project')
        .findOne({ where: { id: proyectoId } as any });
      if (!proyecto) throw new NotFoundException('Proyecto no encontrado.');

      // Verificar pertenencia: primero via liderId (fuente principal),
      // como fallback via proyecto_usuarios (por si liderId quedó NULL por inconsistencia de datos).
      const esLiderDirecto = Number((proyecto as any).liderId) === actorId;

      let esLiderPorMembresía = false;
      if (!esLiderDirecto) {
        const count = await this.ticketsRepository.manager.query(
          `SELECT COUNT(*) as cnt FROM proyecto_usuarios WHERE project_id = ? AND user_id = ?`,
          [proyectoId, actorId],
        );
        esLiderPorMembresía = Number(count[0]?.cnt) > 0;
      }

      if (!esLiderDirecto && !esLiderPorMembresía) {
        throw new ForbiddenException(
          'Solo puedes crear tareas en el proyecto del que eres líder técnico.'
        );
      }
    }

    let requiere_adjunto = createTicketDto.requiere_adjunto ?? false;
    // trimestre_id por defecto: el que envíe el frontend (cola de trabajo del
    // trimestre activo). Si la tarea tiene módulo, se sobrescribe con el del módulo.
    let trimestre_id = createTicketDto.trimestre_id ?? null;

    // Si el ticket tiene sprint_id, cargamos su trimestre para:
    //   1) acotar la tarea al trimestre del módulo (trimestre_id)
    //   2) activar requiere_adjunto si el trimestre es documental
    if (createTicketDto.sprint_id) {
      const sprint = await this.ticketsRepository.manager
        .getRepository(Sprint)
        .findOne({
          where:     { id: createTicketDto.sprint_id },
          relations: ['trimestre'],
        });

      if (sprint?.trimestre_id) trimestre_id = sprint.trimestre_id;

      if (!requiere_adjunto && sprint?.trimestre?.tipo === TipoTrimestre.DOCUMENTAL) {
        // ── REGLA: sprint en trimestre documental → adjunto obligatorio ──
        requiere_adjunto = true;
      }
    }

    // ── Bloquear creación en trimestres HISTÓRICOS ──────────────────────────
    // Si el trimestre destino está marcado como histórico, no se permiten tareas.
    if (trimestre_id) {
      const trim = await this.ticketsRepository.manager
        .getRepository(Trimestre)
        .findOne({ where: { id: trimestre_id } });
      if (trim?.estado === EstadoTrimestre.HISTORICO) {
        throw new BadRequestException(
          'No se pueden crear tareas en un trimestre histórico. Es solo referencia documental.',
        );
      }
    }

    // ── Asignar número de tarea dentro del módulo ────────────────────────────
    let ticket_number: number | null = null;
    if (createTicketDto.sprint_id) {
      const count = await this.ticketsRepository.count({
        where: { sprint_id: createTicketDto.sprint_id },
      });
      ticket_number = count + 1;
    }

    // ── Generar codigo_referencia único global (5 dígitos: 10000-99999) ──
    const codigo_referencia = await this.generateCodigoReferencia();

    const ticket = this.ticketsRepository.create({
      ...createTicketDto,
      requiere_adjunto,
      trimestre_id,
      ticket_number,
      codigo_referencia,
    });
    const saved = await this.ticketsRepository.save(ticket as any) as any;

    // Notificar al aprendiz asignado (si hay uno y no es quien la creó).
    // Envuelto en try/catch para que un fallo de SMTP o notificaciones
    // no devuelva 500 al cliente — el ticket ya fue guardado correctamente.
    try {
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
          action_data: JSON.stringify({ ticket_id: saved.id, proyecto_id: saved.proyecto_id }),
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
      } else if (!saved.asignado_a_id && saved.proyecto_id) {
        // ── Tarea SIN asignar → avisar a TODO el equipo (pueden tomarla) ──────
        const proyecto: any = await this.ticketsRepository.manager
          .getRepository('Project')
          .findOne({ where: { id: saved.proyecto_id }, relations: ['miembros', 'lider'] });

        if (proyecto) {
          const equipo = new Map<number, any>();
          for (const m of (proyecto.miembros ?? [])) equipo.set(m.id, m);
          if (proyecto.lider) equipo.set(proyecto.lider.id, proyecto.lider);
          // No notificar a quien creó la tarea
          equipo.delete(Number(createTicketDto.creado_por_id));

          for (const miembro of equipo.values()) {
            await this.notificationsService.create({
              usuario_id: miembro.id,
              titulo:     `🆕 Nueva tarea disponible: "${saved.titulo}"`,
              mensaje:    `Hay una tarea sin asignar en "${proyecto.nombre}". Tómala desde el tablero si quieres encargarte.`,
              tipo:       'info' as any,
              action_data: JSON.stringify({ ticket_id: saved.id, proyecto_id: saved.proyecto_id }),
            });
          }
        }
      }
    } catch (err) {
      // No relanzar: el ticket fue creado exitosamente.
      // El fallo es solo en el canal de notificación/email.
      console.error('[TicketsService.create] Error enviando notificación:', err?.message);
    }

    // ── Real-time: refrescar el tablero del proyecto al crear la tarea ────────
    try {
      this.gateway.broadcastTicketUpdated(saved.proyecto_id, saved);
    } catch (err: any) { console.error('[TicketsService] Error en broadcastTicketUpdated:', err?.message); }

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
      // 'adjuntos' se incluye para mostrar miniaturas en las tarjetas del tablero
      relations: ['asignado_a', 'creado_por', 'subtareas', 'adjuntos'],
    });
  }

  // ── MODIFICADO: incluye adjuntos + valida permisos de acceso ─────────────
  // El parámetro `actor` (req.user) es opcional para compatibilidad con
  // llamadas internas, pero el controller SIEMPRE lo pasa para verificar
  // que el usuario tenga permiso sobre el proyecto al que pertenece la tarea.
  async findOne(id: number, actor?: any): Promise<Ticket> {
    const ticket = await this.ticketsRepository.findOne({
      where: { id },
      relations: [
        'proyecto',
        'proyecto.ficha',
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
    if (!ticket) throw new NotFoundException('Ticket no encontrado');

    // ── Control de acceso ───────────────────────────────────────────────────
    // Si no hay actor (llamada interna), no validamos. Si lo hay, debe ser:
    //   • coordinador (acceso total), o
    //   • instructor de la ficha del proyecto, o
    //   • líder del proyecto, o
    //   • miembro del proyecto (proyecto_usuarios).
    // De lo contrario lanzamos 403 — privacidad entre fichas/proyectos.
    if (actor) {
      const allowed = await this.userCanAccessTicket(ticket as any, actor);
      if (!allowed) {
        throw new ForbiddenException('No tienes permiso para ver esta tarea.');
      }
    }

    return ticket;
  }

  /** ¿El usuario `actor` puede ver/operar este ticket? */
  private async userCanAccessTicket(ticket: any, actor: any): Promise<boolean> {
    if (!actor) return false;
    if (actor.rol === 'coordinador') return true;

    const proyecto: any = ticket.proyecto;
    if (!proyecto) return false;

    // Instructor: dueño de la ficha del proyecto
    if (actor.rol === 'instructor') {
      return Number(proyecto?.ficha?.instructor_id) === Number(actor.id);
    }

    // Aprendiz / líder técnico: líder del proyecto o miembro de proyecto_usuarios
    if (Number(proyecto.liderId) === Number(actor.id)) return true;
    const rows = await this.ticketsRepository.manager.query(
      `SELECT 1 FROM proyecto_usuarios WHERE project_id = ? AND user_id = ? LIMIT 1`,
      [proyecto.id, actor.id],
    );
    return rows?.length > 0;
  }

  // ── MODIFICADO: validación de adjunto obligatorio antes de marcar done ────
  // También incluye validación de permisos por rol:
  //   • aprendiz normal        → solo puede mover a to_do / in_progress
  //   • aprendiz-líder técnico → puede mover hasta testing
  //   • instructor / coordinador → puede mover a cualquier estado, incluido done
  // actor = req.user (del JWT) — identifica QUIÉN realizó el cambio de estado.
  // Si no se pasa (llamadas internas), se cae al creador del ticket como fallback.
  async updateStatus(id: number, statusDto: any, actor?: any): Promise<Ticket> {
    const ticket = await this.ticketsRepository.findOne({
      where:     { id },
      // ── NUEVO: cargar adjuntos para validar ───────────────────────
      relations: ['adjuntos'],
    });
    if (!ticket) throw new NotFoundException('Ticket no encontrado');

    // ── Validación de permisos por rol ───────────────────────────────────
    // Regla: aprendiz solo hasta in_progress; líder técnico hasta testing;
    //        instructor/coordinador pueden mover a cualquier estado.
    const rolActor = actor?.rol ?? null;
    const esLiderActor = actor?.es_lider_tecnico === true;
    if (rolActor === 'aprendiz') {
      if (!esLiderActor && (statusDto.estado === TicketStatus.TESTING || statusDto.estado === TicketStatus.DONE)) {
        throw new ForbiddenException('Los aprendices solo pueden mover tareas hasta "En desarrollo".');
      }
      if (esLiderActor && statusDto.estado === TicketStatus.DONE) {
        throw new ForbiddenException('El líder técnico no puede marcar tareas como "Finalizado". Eso corresponde al instructor.');
      }
    }

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
    // Envuelto en try/catch para que un fallo de notificación no devuelva 500.
    try {
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

        // action_data común: deep-link a esta tarea
        const ad = JSON.stringify({ ticket_id: id, proyecto_id: (updated as any).proyecto_id });

        // Tarea completada → notificar al creador/líder (si no fue él mismo quien la completó)
        if (statusDto.estado === TicketStatus.DONE) {
          if (updated.creado_por_id && updated.creado_por_id !== actorId) {
            await this.notificationsService.create({
              usuario_id: updated.creado_por_id,
              titulo:     `Tarea completada: "${titulo}"`,
              mensaje:    `${actorNombre} marcó como completada la tarea "${titulo}" en "${proyecto}".`,
              tipo:       'success' as any,
              action_data: ad,
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
              action_data: ad,
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
              action_data: ad,
            });
          }
        }
      }
    } catch (err) {
      console.error('[TicketsService.updateStatus] Error enviando notificación:', err?.message);
    }

    const updated = await this.findOne(id);
    // ── Real-time: broadcast al tablero del proyecto ──────────────────────
    if ((updated as any).proyecto_id) {
      this.gateway.broadcastTicketUpdated((updated as any).proyecto_id, updated);
    }
    return updated;
  }

  async update(id: number, updateTicketDto: any, actor?: any): Promise<Ticket> {
    // Antes de actualizar, capturamos el asignado anterior
    const antes = await this.ticketsRepository.findOne({
      where:     { id },
      relations: ['creado_por', 'proyecto'],
    });
    if (!antes) throw new NotFoundException('Tarea no encontrada');

    // ── Validación: las tareas finalizadas no pueden modificarse ────────────
    // Salvo que el actor sea instructor o coordinador (para correcciones).
    if (antes.estado === TicketStatus.DONE && actor) {
      const esAdmin = actor.rol === 'instructor' || actor.rol === 'coordinador';
      if (!esAdmin) {
        throw new ForbiddenException(
          'No puedes editar una tarea finalizada. Pide al instructor que la reabra si necesitas corregirla.'
        );
      }
    }

    await this.ticketsRepository.update(id, updateTicketDto);

    // Si se está cambiando el asignado → notificar al nuevo responsable.
    // Envuelto en try/catch para que un fallo de SMTP no devuelva 500.
    try {
      if (
        updateTicketDto.asignado_a_id !== undefined &&
        updateTicketDto.asignado_a_id !== null &&
        updateTicketDto.asignado_a_id !== (antes as any)?.asignado_a_id
      ) {
        const full = await this.ticketsRepository.findOne({
          where:     { id },
          relations: ['proyecto', 'creado_por', 'asignado_a', 'sprint'],
        });
        // Usar el nombre del actor real (quien hizo la asignación), no el del creador
        // original. Antes había bug: si A creaba y B reasignaba, la notificación
        // decía "A te asignó" cuando fue B quien la reasignó.
        const asignadorNombre = actor?.nombre ?? full?.creado_por?.nombre ?? 'Tu líder técnico';

        // In-app — incluye action_data con el id de la tarea para deep-link
        await this.notificationsService.create({
          usuario_id: updateTicketDto.asignado_a_id,
          titulo:     `Nueva tarea asignada: "${antes?.titulo}"`,
          mensaje:    `${asignadorNombre} te asignó la tarea "${antes?.titulo}" en el proyecto "${(full as any)?.proyecto?.nombre ?? ''}".`,
          tipo:       'info' as any,
          action_data: JSON.stringify({ ticket_id: id, proyecto_id: (full as any)?.proyecto_id }),
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
    } catch (err) {
      console.error('[TicketsService.update] Error enviando notificación:', err?.message);
    }

    return this.findOne(id);
  }

  async moveTask(ticketId: number, sprintId: number | null): Promise<Ticket> {
    const patch: any = { sprint_id: sprintId };

    if (sprintId) {
      const sprint = await this.ticketsRepository.manager
        .getRepository(Sprint)
        .findOne({ where: { id: sprintId } });
      if (sprint?.trimestre_id) patch.trimestre_id = sprint.trimestre_id;

      // Asignar número dentro del módulo si aún no tiene uno
      const current = await this.ticketsRepository.findOne({ where: { id: ticketId } });
      if (!current?.ticket_number) {
        const count = await this.ticketsRepository.count({ where: { sprint_id: sprintId } });
        patch.ticket_number = count + 1;
      }
    }

    await this.ticketsRepository.update(ticketId, patch);
    return this.findOne(ticketId);
  }

  async setFlag(
    ticketId: number,
    flagDto: { isBlocked: boolean; reason?: string },
  ): Promise<Ticket> {
    await this.ticketsRepository.update(ticketId, {
      esta_bloqueado:  flagDto.isBlocked,
      motivo_bloqueo:  flagDto.reason ?? null,
      // Guardar/limpiar fecha desde cuando está bloqueada (para UI "hace X días")
      bloqueada_desde: flagDto.isBlocked ? new Date() : null,
    });
    return this.findOne(ticketId);
  }

  async remove(id: number): Promise<void> {
    // Cargar la tarea antes de borrarla para poder notificar al asignado.
    const ticket = await this.ticketsRepository.findOne({
      where:     { id },
      relations: ['asignado_a', 'proyecto'],
    });

    // Los adjuntos se borran en cascada por la FK en ticket_attachments,
    // pero también borramos los archivos físicos del disco.
    const adjuntos = await this.attachmentsRepo.find({ where: { ticket_id: id } });
    for (const adj of adjuntos) {
      this.eliminarArchivoDisco(adj.nombre_disco);
    }
    await this.ticketsRepository.delete(id);

    // Notificar al asignado para mantener trazabilidad
    try {
      if (ticket?.asignado_a?.id) {
        await this.notificationsService.create({
          usuario_id: ticket.asignado_a.id,
          titulo:     `Tarea eliminada: "${ticket.titulo}"`,
          mensaje:    `La tarea "${ticket.titulo}" del proyecto "${(ticket as any)?.proyecto?.nombre ?? ''}" fue eliminada.`,
          tipo:       'warning' as any,
        });
      }
    } catch (err) {
      console.error('[TicketsService.remove] Error enviando notificación:', err?.message);
    }
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

    // Auto-transición: si el ticket estaba en "Por hacer" y el uploader
    // es el aprendiz asignado, pasarlo automáticamente a "En desarrollo".
    if (
      ticket.estado === TicketStatus.TODO &&
      ticket.asignado_a_id &&
      ticket.asignado_a_id === subido_por_id
    ) {
      await this.ticketsRepository.update(ticketId, { estado: TicketStatus.IN_PROGRESS });
    }

    // URL relativa — nginx proxia /uploads/ al backend tanto en prod como en dev.
    // No se usa URL absoluta para evitar hardcodear el dominio/puerto.
    const url = `/uploads/attachments/${file.filename}`;

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
  async deleteAttachment(attachmentId: number, actor?: any): Promise<{ message: string }> {
    const attachment = await this.attachmentsRepo.findOne({
      where: { id: attachmentId },
    });
    if (!attachment) throw new NotFoundException('Adjunto no encontrado');

    // ── Validación de permisos ─────────────────────────────────────────────
    // Solo puede borrar el adjunto: el que lo subió, el líder técnico,
    // el instructor o el coordinador.
    if (actor) {
      const esAdmin = actor.rol === 'coordinador' || actor.rol === 'instructor';
      const esLider = actor.rol === 'aprendiz' && actor.es_lider_tecnico === true;
      const esDueno = attachment.subido_por_id === actor.id;
      if (!esAdmin && !esLider && !esDueno) {
        throw new ForbiddenException('No tienes permisos para eliminar este adjunto.');
      }
    }

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

    // Notificar al líder (creador) que alguien tomó la tarea. try/catch para SMTP.
    try {
      const full = await this.ticketsRepository.findOne({
        where:     { id: ticketId },
        relations: ['asignado_a', 'proyecto'],
      });
      if (ticket.creado_por_id && ticket.creado_por_id !== userId) {
        await this.notificationsService.create({
          usuario_id: ticket.creado_por_id,
          titulo:  `Tarea tomada: "${ticket.titulo}"`,
          mensaje: `${full?.asignado_a?.nombre ?? 'Un aprendiz'} tomó la tarea "${ticket.titulo}" en "${(full as any)?.proyecto?.nombre ?? ''}".`,
          action_data: JSON.stringify({ ticket_id: ticket.id, proyecto_id: (ticket as any).proyecto_id }),
          tipo:    'info' as any,
        });
      }
    } catch (err) {
      console.error('[TicketsService.claimTicket] Error enviando notificación:', err?.message);
    }

    return this.findOne(ticketId);
  }

  // Aprendiz finaliza su trabajo → la tarea pasa directamente a "En revisión"
  // (estado testing) para que el líder la revise.
  async markCompleteByAprendiz(ticketId: number, userId: number): Promise<Ticket> {
    const ticket = await this.ticketsRepository.findOne({
      where:     { id: ticketId },
      relations: ['creado_por', 'proyecto', 'subtareas'],
    });
    if (!ticket) throw new NotFoundException('Ticket no encontrado');
    if (ticket.asignado_a_id !== userId) {
      throw new ForbiddenException('Solo el aprendiz asignado puede finalizar esta tarea.');
    }
    if (ticket.estado === TicketStatus.TESTING || ticket.estado === TicketStatus.DONE) {
      throw new BadRequestException('La tarea ya está en revisión o finalizada.');
    }

    // ── Validación de subtareas ──────────────────────────────────────────────
    // Si la tarea tiene subtareas, todas deben estar en 'done' antes de poder
    // enviarla a revisión. Garantiza que el aprendiz no puede "saltar" trabajo.
    const subtareas = (ticket as any).subtareas ?? [];
    const incompletas = subtareas.filter((s: any) => s.estado !== TicketStatus.DONE);
    if (incompletas.length > 0) {
      throw new BadRequestException(
        `No puedes finalizar esta tarea: tiene ${incompletas.length} subtarea(s) sin completar. ` +
        `Completa todas las subtareas primero.`
      );
    }

    // Pasar a "En revisión" (testing) para que el líder la revise.
    await this.ticketsRepository.update(ticketId, {
      estado:                  TicketStatus.TESTING,
      completado_por_aprendiz: true,
      // Si estaba bloqueada (rechazada previamente), limpiar el bloqueo al reenviar
      esta_bloqueado:          false,
      motivo_bloqueo:          null as any,
      bloqueada_desde:         null as any,
    });

    // Notificar al líder (creador) para que revise. try/catch para SMTP.
    try {
      if (ticket.creado_por_id && ticket.creado_por_id !== userId) {
        const full = await this.ticketsRepository.findOne({
          where:     { id: ticketId },
          relations: ['asignado_a', 'proyecto', 'creado_por', 'sprint'],
        });

        // In-app
        await this.notificationsService.create({
          usuario_id: ticket.creado_por_id,
          titulo:  `Tarea enviada a revisión: "${ticket.titulo}"`,
          mensaje: `${(full as any)?.asignado_a?.nombre ?? 'Un aprendiz'} finalizó la tarea "${ticket.titulo}". Revísala en el tablero.`,
          action_data: JSON.stringify({ ticket_id: ticket.id, proyecto_id: (ticket as any).proyecto_id }),
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
    } catch (err) {
      console.error('[TicketsService.markCompleteByAprendiz] Error enviando notificación:', err?.message);
    }

    return this.findOne(ticketId);
  }

  // Líder aprueba la tarea enviada por el aprendiz → testing → done (Finalizado).
  async liderApprove(ticketId: number): Promise<Ticket> {
    const ticket = await this.ticketsRepository.findOne({
      where:     { id: ticketId },
      relations: ['asignado_a', 'proyecto'],
    });
    if (!ticket) throw new NotFoundException('Ticket no encontrado');
    if (ticket.estado !== TicketStatus.TESTING) {
      throw new BadRequestException('Solo se pueden aprobar tareas que estén "En revisión".');
    }
    if (ticket.requiere_adjunto) {
      const count = await this.attachmentsRepo.count({ where: { ticket_id: ticketId } });
      if (count === 0) {
        throw new BadRequestException(
          `"${ticket.titulo}" requiere al menos un adjunto antes de poder finalizarse.`
        );
      }
    }

    await this.ticketsRepository.update(ticketId, {
      completado_por_aprendiz: false,
      estado:                  TicketStatus.DONE,
    });

    // Notificar al aprendiz que su trabajo fue aprobado. try/catch para SMTP.
    try {
      if (ticket.asignado_a_id) {
        const proyectoNombre = (ticket as any).proyecto?.nombre ?? '';
        // In-app
        await this.notificationsService.create({
          usuario_id: ticket.asignado_a_id,
          titulo:  `¡Tarea aprobada! "${ticket.titulo}"`,
          mensaje: `Tu líder aprobó tu trabajo en "${ticket.titulo}". La tarea quedó Finalizada. ¡Bien hecho!`,
          action_data: JSON.stringify({ ticket_id: ticket.id, proyecto_id: (ticket as any).proyecto_id }),
          tipo:    'success' as any,
        });

        // Email al aprendiz
        if ((ticket as any)?.asignado_a?.correo) {
          await this.emailService.notificarTareaAprobada({
            destinatario:   (ticket as any).asignado_a.correo,
            aprendizNombre: (ticket as any).asignado_a.nombre,
            tareaTitle:     ticket.titulo,
            proyectoNombre,
          });
        }
      }
    } catch (err) {
      console.error('[TicketsService.liderApprove] Error enviando notificación:', err?.message);
    }

    return this.findOne(ticketId);
  }

  // Líder rechaza la revisión → la tarea vuelve a "En desarrollo" marcada en rojo.
  // El aprendiz puede corregir y volver a enviar (markCompleteByAprendiz limpia el bloqueo).
  async liderReject(ticketId: number, motivo?: string): Promise<Ticket> {
    const ticket = await this.ticketsRepository.findOne({
      where:     { id: ticketId },
      relations: ['asignado_a', 'proyecto'],
    });
    if (!ticket) throw new NotFoundException('Ticket no encontrado');
    if (ticket.estado !== TicketStatus.TESTING) {
      throw new BadRequestException('Solo se pueden rechazar tareas que estén "En revisión".');
    }

    const motivo_bloqueo = motivo?.trim() || 'Devuelta por el líder. Revisa los comentarios y corrige.';

    await this.ticketsRepository.update(ticketId, {
      completado_por_aprendiz: false,
      estado:                  TicketStatus.IN_PROGRESS,
      // Marcar en rojo: el aprendiz ve la tarjeta roja hasta que la reenvíe
      esta_bloqueado:          true,
      motivo_bloqueo,
      bloqueada_desde:         new Date(),
    });

    // Notificar al aprendiz que debe corregir. try/catch para SMTP.
    try {
      if (ticket.asignado_a_id) {
        const proyectoNombre = (ticket as any).proyecto?.nombre ?? '';
        // In-app
        await this.notificationsService.create({
          usuario_id: ticket.asignado_a_id,
          titulo:  `Tarea devuelta con correcciones: "${ticket.titulo}"`,
          mensaje: `Tu líder necesita correcciones en "${ticket.titulo}". Motivo: ${motivo_bloqueo}`,
          action_data: JSON.stringify({ ticket_id: ticket.id, proyecto_id: (ticket as any).proyecto_id }),
          tipo:    'warning' as any,
        });

        // Email al aprendiz
        if ((ticket as any)?.asignado_a?.correo) {
          await this.emailService.notificarTareaDevuelta({
            destinatario:   (ticket as any).asignado_a.correo,
            aprendizNombre: (ticket as any).asignado_a.nombre,
            tareaTitle:     ticket.titulo,
            proyectoNombre,
          });
        }
      }
    } catch (err) {
      console.error('[TicketsService.liderReject] Error enviando notificación:', err?.message);
    }

    return this.findOne(ticketId);
  }

  // ══ INSTRUCTOR: calificación final de la tarea ════════════════════════════

  // Instructor aprueba → testing → done.
  // Notifica al aprendiz asignado y al creador (líder).
  async instructorApprove(ticketId: number): Promise<Ticket> {
    const ticket = await this.ticketsRepository.findOne({
      where:     { id: ticketId },
      relations: ['asignado_a', 'creado_por', 'proyecto'],
    });
    if (!ticket) throw new NotFoundException('Ticket no encontrado');
    if (ticket.estado !== TicketStatus.TESTING) {
      throw new BadRequestException('Solo se pueden aprobar tareas que estén "En revisión".');
    }
    if (ticket.requiere_adjunto) {
      const count = await this.attachmentsRepo.count({ where: { ticket_id: ticketId } });
      if (count === 0) {
        throw new BadRequestException(
          `"${ticket.titulo}" requiere al menos un adjunto antes de poder finalizarse.`
        );
      }
    }

    await this.ticketsRepository.update(ticketId, {
      estado:         TicketStatus.DONE,
      actualizado_en: new Date(),
    });

    try {
      const proyectoNombre = (ticket as any).proyecto?.nombre ?? '';
      // Notificar al aprendiz
      if (ticket.asignado_a_id) {
        await this.notificationsService.create({
          usuario_id: ticket.asignado_a_id,
          titulo:  `¡Tarea finalizada! "${ticket.titulo}"`,
          mensaje: `El instructor aprobó tu tarea "${ticket.titulo}" en "${proyectoNombre}". ¡Bien hecho!`,
          action_data: JSON.stringify({ ticket_id: ticket.id, proyecto_id: (ticket as any).proyecto_id }),
          tipo:    'success' as any,
        });
        if ((ticket as any)?.asignado_a?.correo) {
          await this.emailService.notificarTareaAprobada({
            destinatario:   (ticket as any).asignado_a.correo,
            aprendizNombre: (ticket as any).asignado_a.nombre,
            tareaTitle:     ticket.titulo,
            proyectoNombre,
          });
        }
      }
      // Notificar al líder creador (si es diferente al aprendiz)
      if (ticket.creado_por_id && ticket.creado_por_id !== ticket.asignado_a_id) {
        await this.notificationsService.create({
          usuario_id: ticket.creado_por_id,
          titulo:  `Tarea aprobada por instructor: "${ticket.titulo}"`,
          mensaje: `El instructor marcó como finalizada la tarea "${ticket.titulo}" en "${proyectoNombre}".`,
          action_data: JSON.stringify({ ticket_id: ticket.id, proyecto_id: (ticket as any).proyecto_id }),
          tipo:    'success' as any,
        });
      }
    } catch (err) {
      console.error('[TicketsService.instructorApprove] Error enviando notificación:', err?.message);
    }

    return this.findOne(ticketId);
  }

  // Instructor rechaza → testing → in_progress + bloqueado (se muestra en rojo).
  // Permite agregar un motivo de rechazo que se guarda en motivo_bloqueo.
  async instructorReject(ticketId: number, motivo?: string): Promise<Ticket> {
    const ticket = await this.ticketsRepository.findOne({
      where:     { id: ticketId },
      relations: ['asignado_a', 'creado_por', 'proyecto'],
    });
    if (!ticket) throw new NotFoundException('Ticket no encontrado');
    if (ticket.estado !== TicketStatus.TESTING) {
      throw new BadRequestException('Solo se pueden rechazar tareas que estén "En revisión".');
    }

    const motivo_bloqueo = motivo?.trim() || 'Rechazado por el instructor. Revisa los comentarios y corrige.';

    await this.ticketsRepository.update(ticketId, {
      estado:                  TicketStatus.IN_PROGRESS,
      esta_bloqueado:          true,
      motivo_bloqueo,
      bloqueada_desde:         new Date(),
      completado_por_aprendiz: false,
      actualizado_en:          new Date(),
    });

    try {
      const proyectoNombre = (ticket as any).proyecto?.nombre ?? '';
      // Notificar al aprendiz asignado
      if (ticket.asignado_a_id) {
        await this.notificationsService.create({
          usuario_id: ticket.asignado_a_id,
          titulo:  `Tarea devuelta por instructor: "${ticket.titulo}"`,
          mensaje: `El instructor devolvió "${ticket.titulo}". Motivo: ${motivo_bloqueo}`,
          action_data: JSON.stringify({ ticket_id: ticket.id, proyecto_id: (ticket as any).proyecto_id }),
          tipo:    'warning' as any,
        });
        if ((ticket as any)?.asignado_a?.correo) {
          await this.emailService.notificarTareaDevuelta({
            destinatario:   (ticket as any).asignado_a.correo,
            aprendizNombre: (ticket as any).asignado_a.nombre,
            tareaTitle:     ticket.titulo,
            proyectoNombre,
          });
        }
      }
      // Notificar al líder creador
      if (ticket.creado_por_id && ticket.creado_por_id !== ticket.asignado_a_id) {
        await this.notificationsService.create({
          usuario_id:  ticket.creado_por_id,
          titulo:      `Tarea rechazada por instructor: "${ticket.titulo}"`,
          mensaje:     `El instructor rechazó "${ticket.titulo}" y la devolvió a desarrollo. Motivo: ${motivo_bloqueo}`,
          tipo:        'warning' as any,
          action_data: JSON.stringify({ ticket_id: ticket.id, proyecto_id: (ticket as any).proyecto_id }),
        });
      }
    } catch (err) {
      console.error('[TicketsService.instructorReject] Error enviando notificación:', err?.message);
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