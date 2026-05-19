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
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs   from 'fs';
import * as path from 'path';

import { Ticket, TicketStatus }   from './entities/ticket.entity';
// ── NUEVO IMPORT ─────────────────────────────────────────────────────────────
import { TicketAttachment }        from './entities/ticket-attachment.entity';
import { TipoTrimestre }           from '../projects/entities/trimestre.entity';

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private ticketsRepository: Repository<Ticket>,
    // ── NUEVO: repositorio de adjuntos ────────────────────────────────────
    @InjectRepository(TicketAttachment)
    private attachmentsRepo: Repository<TicketAttachment>,
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
    return this.ticketsRepository.save(ticket as any);
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
  async updateStatus(id: number, statusDto: any): Promise<Ticket> {
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
    return this.findOne(id);
  }

  async update(id: number, updateTicketDto: any): Promise<Ticket> {
    await this.ticketsRepository.update(id, updateTicketDto);
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