// ── MODIFICADO ───────────────────────────────────────────────────────────────
// Cambios respecto a la versión original:
//
//  1. Se configura Multer para subir archivos a /uploads/attachments/.
//     - Tipos permitidos: pdf, doc, docx, pptx, xlsx, png, jpg, jpeg, svg, zip, rar, txt
//     - Tamaño máximo: 20 MB por archivo
//     - Nombre en disco: UUID + extensión original (sin espacios ni caracteres especiales)
//
//  2. NUEVOS endpoints:
//     POST   /tickets/:id/attachments        → subir un archivo al ticket
//     GET    /tickets/:id/attachments        → listar adjuntos del ticket
//     DELETE /tickets/:id/attachments/:aid   → borrar un adjunto
// ─────────────────────────────────────────────────────────────────────────────

import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  Query, UseGuards, Request, UseInterceptors, UploadedFile,
  BadRequestException,ForbiddenException,
} from '@nestjs/common';
import { AuthGuard }            from '@nestjs/passport';
import { FileInterceptor }      from '@nestjs/platform-express';
import { diskStorage }          from 'multer';
import { extname, join }        from 'path';
import { existsSync, mkdirSync } from 'fs';
import { v4 as uuidv4 }         from 'uuid';
import { TicketsService }        from './tickets.service';

// ── Configuración de Multer ───────────────────────────────────────────────────
// Define dónde y cómo se guardan los archivos subidos.
const attachmentsStorage = diskStorage({
  // Guardar en /uploads/attachments/ (se crea si no existe)
  destination: (req, file, cb) => {
    const dest = join(process.cwd(), 'uploads', 'attachments');
    if (!existsSync(dest)) {
      mkdirSync(dest, { recursive: true });
    }
    cb(null, dest);
  },

  // Nombre único en disco: UUID + extensión original
  // Ej: "a3f8c2d1.pdf" — evita colisiones y caracteres problemáticos
  filename: (req, file, cb) => {
    const ext      = extname(file.originalname).toLowerCase();
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  },
});

// ── Tipos de archivo permitidos ───────────────────────────────────────────────
// Documentos, imágenes, comprimidos y texto plano.
const ALLOWED_MIMETYPES = [
  // Documentos
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // Imágenes
  'image/png',
  'image/jpeg',
  'image/svg+xml',
  // Comprimidos
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/vnd.rar',
  // Texto
  'text/plain',
];

const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new BadRequestException(
        `Tipo de archivo no permitido: "${file.mimetype}". ` +
        `Se aceptan: PDF, Word, PowerPoint, Excel, PNG, JPG, SVG, ZIP, RAR, TXT.`
      ),
      false,
    );
  }
};

@UseGuards(AuthGuard('jwt'))
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  // ── Endpoints existentes (sin cambios en rutas) ───────────────────────────

 @Post()
  async create(@Body() createTicketDto: any, @Request() req: any) {
    const usuario = req.user;
    const esLider = usuario?.rol === 'aprendiz' && usuario?.es_lider_tecnico === true;

    // Solo coordinador, instructor o aprendiz-líder pueden crear tareas.
    // Un aprendiz normal no tiene esta capacidad.
    if (usuario?.rol === 'aprendiz' && !esLider) {
      throw new ForbiddenException(
        'Solo el líder técnico puede crear tareas dentro de un sprint.'
      );
    }

    // El líder técnico solo puede crear tareas en su propio proyecto.
    // (El service validará la pertenencia para instructor/coordinador
    //  si se desea restringir más estrictamente).
    return this.ticketsService.create(
      {
        ...createTicketDto,
        creado_por_id: usuario?.id ?? null,
      },
      usuario,
    );
  }

  @Get()
  findAll(
    @Query('proyecto_id') proyecto_id?: string,
    @Query('sprint_id')   sprint_id?:   string,
    @Query('backlog')     backlog?:     string,
    @Request() req?: any,
  ) {
    const rol     = req?.user?.rol;
    const esLider = rol === 'aprendiz' && req?.user?.es_lider_tecnico === true;

    // Sin proyecto_id: aplicar auto-scope según el rol.
    if (!proyecto_id) {
      if (rol === 'aprendiz' && !esLider) {
        // Aprendiz normal → solo sus propias tareas asignadas (nunca el sistema completo).
        return this.ticketsService.findAll(
          undefined, undefined, false, req.user.id,
        );
      }
      // Líder técnico sin proyecto_id también podría caer aquí; se le permite porque
      // su dashboard sí pasa proyecto_id. Si no lo hace, caerá al path sin filtro.
      if (rol !== 'coordinador' && rol !== 'instructor' && !esLider) {
        throw new ForbiddenException('Se requiere proyecto_id para listar tickets.');
      }
    }

    return this.ticketsService.findAll(
      proyecto_id ? +proyecto_id : undefined,
      sprint_id   ? +sprint_id   : undefined,
      backlog === 'true',
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    // Pasar el actor para que el service valide privacidad
    // (un aprendiz no puede leer tareas de otra ficha/proyecto).
    return this.ticketsService.findOne(+id, req.user);
  }

  // MODIFICADO: ahora valida adjunto antes de pasar a done
  // actor (req.user) se pasa al service para que las notificaciones
  // muestren QUIÉN realmente cambió el estado, no el creador del ticket.
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() statusDto: any, @Request() req: any) {
    return this.ticketsService.updateStatus(+id, statusDto, req.user);
  }

  @Patch(':id/move')
  moveTask(
    @Param('id') id: string,
    @Body('sprint_id') sprint_id: number | null,
    @Request() req: any,
  ) {
    // Solo coordinador, instructor o líder técnico pueden mover tareas entre módulos.
    // Un aprendiz normal no debería poder reorganizar la planificación del equipo.
    const usuario = req.user;
    const esLider = usuario?.rol === 'aprendiz' && usuario?.es_lider_tecnico === true;
    if (usuario?.rol === 'aprendiz' && !esLider) {
      throw new ForbiddenException('Solo el líder técnico puede mover tareas entre módulos.');
    }
    return this.ticketsService.moveTask(+id, sprint_id);
  }

  @Patch(':id/flag')
  setFlag(
    @Param('id') id: string,
    @Body() flagDto: { isBlocked: boolean; reason?: string },
    @Request() req: any,
  ) {
    // Bloquear/desbloquear es una acción de liderazgo: coordinador, instructor o líder técnico.
    const usuario = req.user;
    const esLider = usuario?.rol === 'aprendiz' && usuario?.es_lider_tecnico === true;
    if (usuario?.rol === 'aprendiz' && !esLider) {
      throw new ForbiddenException('Solo el líder técnico puede bloquear o desbloquear tareas.');
    }
    return this.ticketsService.setFlag(+id, flagDto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTicketDto: any, @Request() req: any) {
    // Edición de tareas: solo coordinador, instructor o líder técnico.
    // Un aprendiz normal no puede editar el contenido de las tareas.
    const usuario = req.user;
    const esLider = usuario?.rol === 'aprendiz' && usuario?.es_lider_tecnico === true;
    if (usuario?.rol === 'aprendiz' && !esLider) {
      throw new ForbiddenException('Solo el líder técnico puede editar tareas.');
    }
    return this.ticketsService.update(+id, updateTicketDto, usuario);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    // Eliminar tareas: solo coordinador, instructor o líder técnico.
    const usuario = req.user;
    const esLider = usuario?.rol === 'aprendiz' && usuario?.es_lider_tecnico === true;
    if (usuario?.rol === 'aprendiz' && !esLider) {
      throw new ForbiddenException('Solo el líder técnico puede eliminar tareas.');
    }
    return this.ticketsService.remove(+id);
  }

  // ══ NUEVOS ENDPOINTS: Adjuntos ════════════════════════════════════════════

  // POST /api/tickets/:id/attachments
  // Sube un archivo al ticket. El frontend envía multipart/form-data con
  // el campo "file" conteniendo el archivo.
  //
  // FileInterceptor intercepta la petición ANTES de que llegue al handler,
  // guarda el archivo en disco vía Multer, y pone el metadata en req.file.
  // Luego el service guarda el registro en BD y devuelve el TicketAttachment.
  @Post(':id/attachments')
  @UseInterceptors(
    FileInterceptor('file', {
      storage:  attachmentsStorage,
      fileFilter,
      limits: {
        // 20 MB máximo por archivo
        fileSize: 20 * 1024 * 1024,
      },
    }),
  )
  uploadAttachment(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo.');
    }
    return this.ticketsService.uploadAttachment(+id, file, req.user?.id);
  }

  // GET /api/tickets/:id/attachments
  // Lista todos los adjuntos del ticket ordenados del más reciente al más antiguo.
  // Incluye: nombre_original, url, tipo_mime, tamano_bytes, subido_por, creado_en.
  @Get(':id/attachments')
  findAttachments(@Param('id') id: string) {
    return this.ticketsService.findAttachments(+id);
  }

  // ══ NUEVOS ENDPOINTS: flujo de reclamación y revisión ════════════════════

  // POST /tickets/:id/claim — aprendiz toma una tarea disponible
  @Post(':id/claim')
  claimTicket(@Param('id') id: string, @Request() req: any) {
    return this.ticketsService.claimTicket(+id, req.user.id);
  }

  // POST /tickets/:id/mark-complete — aprendiz marca su trabajo como listo
  @Post(':id/mark-complete')
  markCompleteByAprendiz(@Param('id') id: string, @Request() req: any) {
    return this.ticketsService.markCompleteByAprendiz(+id, req.user.id);
  }

  // POST /tickets/:id/lider-approve — líder aprueba → pasa a testing
  // Solo líder técnico, instructor o coordinador.
  @Post(':id/lider-approve')
  liderApprove(@Param('id') id: string, @Request() req: any) {
    const usuario = req.user;
    const esLider = usuario?.rol === 'aprendiz' && usuario?.es_lider_tecnico === true;
    if (!esLider && usuario?.rol !== 'instructor' && usuario?.rol !== 'coordinador') {
      throw new ForbiddenException('Solo el líder técnico, instructor o coordinador puede aprobar tareas.');
    }
    return this.ticketsService.liderApprove(+id);
  }

  // POST /tickets/:id/lider-reject — líder rechaza → devuelve en rojo (in_progress + bloqueado)
  // Body opcional: { motivo: string }
  // Solo líder técnico, instructor o coordinador.
  @Post(':id/lider-reject')
  liderReject(@Param('id') id: string, @Body('motivo') motivo: string | undefined, @Request() req: any) {
    const usuario = req.user;
    const esLider = usuario?.rol === 'aprendiz' && usuario?.es_lider_tecnico === true;
    if (!esLider && usuario?.rol !== 'instructor' && usuario?.rol !== 'coordinador') {
      throw new ForbiddenException('Solo el líder técnico, instructor o coordinador puede rechazar tareas.');
    }
    return this.ticketsService.liderReject(+id, motivo);
  }

  // POST /tickets/:id/instructor-approve — instructor aprueba → testing → done
  // Solo accessible para rol instructor o coordinador.
  @Post(':id/instructor-approve')
  instructorApprove(@Param('id') id: string, @Request() req: any) {
    const rol = req.user?.rol;
    if (rol !== 'instructor' && rol !== 'coordinador') {
      throw new ForbiddenException('Solo el instructor o coordinador puede finalizar tareas.');
    }
    return this.ticketsService.instructorApprove(+id);
  }

  // POST /tickets/:id/instructor-reject — instructor rechaza → in_progress + bloqueado (rojo)
  // Body opcional: { motivo: string }
  @Post(':id/instructor-reject')
  instructorReject(
    @Param('id')   id:   string,
    @Body('motivo') motivo: string | undefined,
    @Request()     req:  any,
  ) {
    const rol = req.user?.rol;
    if (rol !== 'instructor' && rol !== 'coordinador') {
      throw new ForbiddenException('Solo el instructor o coordinador puede rechazar tareas.');
    }
    return this.ticketsService.instructorReject(+id, motivo);
  }

  // DELETE /api/tickets/:id/attachments/:aid
  // Borra un adjunto: elimina el archivo del disco y el registro de la BD.
  // El :id del ticket se incluye en la ruta por claridad, pero la validación
  // se hace por el :aid (attachment id) que ya es único.
  @Delete(':id/attachments/:aid')
  deleteAttachment(
    @Param('id')  id:  string,
    @Param('aid') aid: string,
    @Request()    req: any,
  ) {
    // Solo el subió el adjunto, un líder técnico, instructor o coordinador puede borrarlo.
    // La validación granular (propiedad) se hace en el service.
    return this.ticketsService.deleteAttachment(+aid, req.user);
  }
}