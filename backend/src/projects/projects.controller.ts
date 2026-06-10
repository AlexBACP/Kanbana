import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  UseGuards, ParseIntPipe, Query, Request, ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProjectsService } from './projects.service';
import { SugerenciasService } from './sugerencias.service';
import { NotificationsService } from '../notifications/notifications.service';

@Controller('projects')
@UseGuards(AuthGuard('jwt'))
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly sugerenciasService: SugerenciasService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // Permiso para gestionar módulos/sugerencias: instructor, coordinador o líder técnico.
  private assertPuedeGestionar(req: any) {
    const rol = req.user?.rol;
    const esLider = rol === 'aprendiz' && req.user?.es_lider_tecnico === true;
    if (rol !== 'coordinador' && rol !== 'instructor' && !esLider) {
      throw new ForbiddenException('No tienes permisos para gestionar sugerencias de módulos.');
    }
  }

  // ── GET /projects — filtra según el rol del usuario autenticado ────────
  // FIX BUG: Antes devolvía TODOS los proyectos a todos los roles.
  // Ahora delega en findForUser() que aplica los filtros correctos.
  @Get()
  findAll(@Request() req: any, @Query('fichaId') fichaId?: string) {
    // Si se pasa fichaId explícito (ej: desde FichasPanel), respetar ese filtro
    if (fichaId) {
      return this.projectsService.findAll({ fichaId: +fichaId });
    }
    // Sin filtro explícito: filtrar por rol
    return this.projectsService.findForUser(req.user);
  }

  // ── NUEVOS ENDPOINTS: gestión manual de trimestres ════════════════════════

  // POST /projects/trimestres/bulk-generate
  // Genera trimestres para múltiples proyectos a la vez.
  // Solo accesible para coordinadores o instructores.
  // IMPORTANTE: Debe estar ANTES de las rutas con :id para no ser capturado como parámetro.
  @Post('trimestres/bulk-generate')
  bulkGenerateTrimestres(@Body() dto: { projectIds: number[]; num: number; trimestres?: any[] }, @Request() req: any) {
    const rol = req.user?.rol;
    if (rol !== 'coordinador' && rol !== 'instructor') {
      throw new ForbiddenException('Solo coordinadores e instructores pueden generar trimestres en masa.');
    }
    return this.projectsService.bulkGenerateTrimestres(dto);
  }

  // POST /projects/seed-modulos
  // Seed one-shot: genera módulos de la plantilla SDLC para TODOS los proyectos
  // con ficha que aún no tienen sprints. Solo coordinador/instructor.
  // IMPORTANTE: ruta estática → debe ir ANTES de las rutas con :id.
  @Post('seed-modulos')
  seedModulos(@Request() req: any) {
    const rol = req.user?.rol;
    if (rol !== 'coordinador' && rol !== 'instructor') {
      throw new ForbiddenException('Solo coordinadores o instructores pueden ejecutar el seed de módulos.');
    }
    return this.projectsService.seedModulosFaltantes();
  }

  // ── Sugerencias inteligentes — acciones por sugerencia (rutas estáticas) ──
  // IMPORTANTE: van ANTES de las rutas con :id para no capturarse como parámetro.

  // POST /projects/sugerencias/:sugId/crear-modulo
  @Post('sugerencias/:sugId/crear-modulo')
  crearModuloDesdeSugerencia(@Param('sugId', ParseIntPipe) sugId: number, @Request() req: any) {
    this.assertPuedeGestionar(req);
    return this.sugerenciasService.crearModulo(sugId);
  }

  // POST /projects/sugerencias/:sugId/descartar
  @Post('sugerencias/:sugId/descartar')
  descartarSugerencia(@Param('sugId', ParseIntPipe) sugId: number, @Request() req: any) {
    this.assertPuedeGestionar(req);
    return this.sugerenciasService.descartar(sugId);
  }

  @Get('for-me')
  findForMe(@Request() req: any) {
    return this.projectsService.findForUser(req.user);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.findOne(id);
  }

  @Post()
  create(@Body() dto: any, @Request() req: any) {
    const rol = req.user?.rol;
    if (rol !== 'coordinador' && rol !== 'instructor') {
      throw new ForbiddenException('Solo coordinadores e instructores pueden crear proyectos.');
    }
    return this.projectsService.create(dto);
  }

  // POST /projects/:id/generar-modulos
  // Genera los módulos de la plantilla SDLC para un proyecto existente que
  // no tiene módulos. Body opcional: { force?: boolean }. Solo admin/instructor.
  @Post(':id/generar-modulos')
  generarModulos(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { force?: boolean },
    @Request() req: any,
  ) {
    const rol = req.user?.rol;
    const esLider = rol === 'aprendiz' && req.user?.es_lider_tecnico === true;
    if (rol !== 'coordinador' && rol !== 'instructor' && !esLider) {
      throw new ForbiddenException('No tienes permisos para generar módulos.');
    }
    return this.projectsService.generarModulosParaProyecto(id, { force: body?.force });
  }

  // ── Sugerencias inteligentes — por proyecto ───────────────────────────────

  // GET /projects/:id/sugerencias — lista las sugerencias activas agrupadas por trimestre
  @Get(':id/sugerencias')
  getSugerencias(@Param('id', ParseIntPipe) id: number) {
    return this.sugerenciasService.listar(id);
  }

  // POST /projects/:id/sugerencias/generar — genera (si no hay) usando IA + catálogo
  @Post(':id/sugerencias/generar')
  generarSugerencias(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    this.assertPuedeGestionar(req);
    return this.sugerenciasService.generar(id, false);
  }

  // POST /projects/:id/sugerencias/regenerar — fuerza un nuevo análisis
  @Post(':id/sugerencias/regenerar')
  regenerarSugerencias(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    this.assertPuedeGestionar(req);
    return this.sugerenciasService.generar(id, true);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Request() req: any) {
    const rol = req.user?.rol;
    if (rol !== 'coordinador' && rol !== 'instructor') {
      throw new ForbiddenException('Solo coordinadores e instructores pueden editar proyectos.');
    }
    return this.projectsService.update(id, dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id', ParseIntPipe) id: number, @Body('estado') estado: string, @Request() req: any) {
    const rol = req.user?.rol;
    if (rol !== 'coordinador' && rol !== 'instructor') {
      throw new ForbiddenException('Solo coordinadores e instructores pueden cambiar el estado de un proyecto.');
    }
    return this.projectsService.updateStatus(id, estado);
  }

  @Patch(':id/assign-lider')
  assignLider(
    @Param('id', ParseIntPipe) id: number,
    @Body('liderId') liderId: number | null,
    @Request() req: any,
  ) {
    const rol = req.user?.rol;
    if (rol !== 'coordinador' && rol !== 'instructor') {
      throw new ForbiddenException('Solo coordinadores e instructores pueden asignar líder técnico.');
    }
    return this.projectsService.assignLider(id, liderId ?? null, req.user.id);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    const rol = req.user?.rol;
    if (rol === 'coordinador') {
      return this.projectsService.remove(id);
    }
    if (rol === 'instructor') {
      // El instructor solo puede eliminar proyectos que él creó
      const proyecto = await this.projectsService.findOne(id);
      if (!proyecto) throw new ForbiddenException('Proyecto no encontrado');
      const instructorId = (proyecto as any).instructorId ?? (proyecto as any).instructor?.id;
      if (instructorId !== req.user.id) {
        throw new ForbiddenException('Solo puedes eliminar proyectos que tú creaste');
      }
      return this.projectsService.remove(id);
    }
    throw new ForbiddenException('No tienes permisos para eliminar proyectos');
  }

  @Get(':id/members')
  getMembers(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.getMembers(id);
  }

  @Post(':id/members')
  addMember(@Param('id', ParseIntPipe) id: number, @Body('userId') userId: number, @Request() req: any) {
    const rol = req.user?.rol;
    if (rol !== 'coordinador' && rol !== 'instructor') {
      throw new ForbiddenException('Solo coordinadores e instructores pueden añadir miembros a un proyecto.');
    }
    return this.projectsService.addMember(id, userId);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Request() req: any,
  ) {
    const rol = req.user?.rol;
    if (rol !== 'coordinador' && rol !== 'instructor') {
      throw new ForbiddenException('Solo coordinadores e instructores pueden eliminar miembros de un proyecto.');
    }
    return this.projectsService.removeMember(id, userId);
  }

  @Get(':id/sprints')
  getSprints(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.findAllSprints(id);
  }

  @Get(':id/sprints/active')
  getActiveSprint(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.findActiveSprint(id);
  }

  @Post(':id/sprints')
  createSprint(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Request() req: any) {
    const rol = req.user?.rol;
    if (rol !== 'coordinador' && rol !== 'instructor') {
      throw new ForbiddenException('Solo coordinadores e instructores pueden crear módulos directamente.');
    }
    return this.projectsService.createSprint(id, dto);
  }

  @Patch('sprints/:sprintId')
  updateSprint(
    @Param('sprintId', ParseIntPipe) sprintId: number,
    @Body() dto: any,
    @Request() req: any,
  ) {
    const rol = req.user?.rol;
    if (rol !== 'coordinador' && rol !== 'instructor') {
      throw new ForbiddenException('Solo coordinadores e instructores pueden editar módulos.');
    }
    return this.projectsService.updateSprint(sprintId, dto);
  }

  @Patch('sprints/:sprintId/start')
  startSprint(@Param('sprintId', ParseIntPipe) sprintId: number, @Request() req: any) {
    const rol = req.user?.rol;
    if (rol !== 'coordinador' && rol !== 'instructor') {
      throw new ForbiddenException('Solo coordinadores e instructores pueden activar módulos.');
    }
    return this.projectsService.startSprint(sprintId);
  }

  @Patch('sprints/:sprintId/close')
  closeSprint(
    @Param('sprintId', ParseIntPipe) sprintId: number,
    @Request() req: any,
  ) {
    const rol = req.user?.rol;
    if (rol !== 'coordinador' && rol !== 'instructor') {
      throw new ForbiddenException('Solo el instructor o coordinador puede finalizar un módulo.');
    }
    return this.projectsService.closeSprint(sprintId);
  }

  @Get(':id/velocity')
  getVelocity(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.getVelocityStats(id);
  }

  // GET /projects/:id/burnup
  @Get(':id/burnup')
  getBurnup(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.getBurnupStats(id);
  }

  // GET /projects/:id/trimestres
  // Lista todos los trimestres de un proyecto ordenados por número.
  @Get(':id/trimestres')
  getTrimestres(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.findTrimestres(id);
  }
  
  // GET /projects/:id/trimestres/sprints-sin-trimestre
  // Devuelve los sprints del proyecto que no tienen trimestre asignado.
  // Se usa en la UI para mostrar la sección "Sin clasificar" y vincularlos.
  @Get(':id/trimestres/sprints-sin-trimestre')
  getSprintsSinTrimestre(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.findSprintsSinTrimestre(id);
  }

  // POST /projects/:id/trimestres/generate
  // Genera o re-genera trimestres para un proyecto.
  @Post(':id/trimestres/generate')
  generateTrimestres(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { num: number; trimestres?: any[] },
  ) {
    return this.projectsService.generateTrimestres(id, dto);
  }

  // PATCH /projects/trimestres/:tid
  // Edita nombre, fechas o tipo de un trimestre existente.
  // Body: { nombre?, fecha_inicio?, fecha_fin?, tipo? }
  @Patch('trimestres/:tid')
  updateTrimestre(
    @Param('tid', ParseIntPipe) tid: number,
    @Body() dto: any,
    @Request() req: any,
  ) {
    const rol = req.user?.rol;
    if (rol !== 'coordinador' && rol !== 'instructor') {
      throw new ForbiddenException('Solo coordinadores e instructores pueden editar trimestres.');
    }
    return this.projectsService.updateTrimestre(tid, dto);
  }

  // PATCH /projects/trimestres/:tid/close
  // Cierra un trimestre (esta_finalizado = true).
  // Solo es posible si todos sus sprints están finalizados.
  // IMPORTANTE: va DESPUÉS de trimestres/:tid para que NestJS lo resuelva correctamente.
  @Patch('trimestres/:tid/close')
  closeTrimestre(@Param('tid', ParseIntPipe) tid: number, @Request() req: any) {
    const rol = req.user?.rol;
    if (rol !== 'coordinador' && rol !== 'instructor') {
      throw new ForbiddenException('Solo coordinadores e instructores pueden cerrar trimestres.');
    }
    return this.projectsService.closeTrimestre(tid);
  }

  // PATCH /projects/sprints/:sprintId/assign-trimestre
  // Vincula un sprint a un trimestre (o lo desvincula con trimestreId: null).
  // Body: { trimestreId: number | null }
  @Patch('sprints/:sprintId/assign-trimestre')
  assignSprintToTrimestre(
    @Param('sprintId', ParseIntPipe) sprintId: number,
    @Body('trimestreId') trimestreId: number | null,
    @Request() req: any,
  ) {
    const rol = req.user?.rol;
    if (rol !== 'coordinador' && rol !== 'instructor') {
      throw new ForbiddenException('Solo coordinadores e instructores pueden vincular módulos a trimestres.');
    }
    return this.projectsService.assignSprintToTrimestre(sprintId, trimestreId ?? null);
  }
  // ══════════════════════════════════════════════════════════════════════════════
  // FLUJO DE REVISIÓN DE MÓDULOS
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * GET /projects/sprints/pending-review
   * Instructor: lista de módulos con pendiente_revision=true en sus proyectos.
   * IMPORTANTE: debe estar ANTES de `:id` para no capturarse como parámetro.
   */
  @Get('sprints/pending-review')
  getSprintsPendientesRevision(@Request() req: any) {
    return this.projectsService.getSprintsPendientesRevision(req.user.id);
  }

  /**
   * POST /projects/sprints/:id/solicitar-revision
   * Líder técnico envía el módulo a revisión del instructor.
   * Valida que todas las tareas estén en testing o done.
   */
  @Post('sprints/:sprintId/solicitar-revision')
  solicitarRevision(
    @Param('sprintId', ParseIntPipe) sprintId: number,
    @Request() req: any,
  ) {
    const usuario = req.user;
    const esLider = usuario?.rol === 'aprendiz' && usuario?.es_lider_tecnico === true;
    if (!esLider) {
      throw new ForbiddenException('Solo el líder técnico puede enviar un módulo a revisión.');
    }
    return this.projectsService.solicitarRevisionSprint(sprintId, usuario.id);
  }

  /**
   * POST /projects/sprints/:id/correcciones
   * Instructor solicita correcciones al líder sobre un módulo.
   * Body: { mensaje: string }
   */
  @Post('sprints/:sprintId/correcciones')
  solicitarCorrecciones(
    @Param('sprintId', ParseIntPipe) sprintId: number,
    @Body('mensaje') mensaje: string,
    @Request() req: any,
  ) {
    const rol = req.user?.rol;
    if (rol !== 'coordinador' && rol !== 'instructor') {
      throw new ForbiddenException('Solo instructores o coordinadores pueden solicitar correcciones.');
    }
    if (!mensaje?.trim()) {
      throw new Error('Debes indicar el motivo de las correcciones.');
    }
    return this.projectsService.solicitarCorreccionesSprint(sprintId, req.user.id, mensaje);
  }

  /**
   * POST /projects/sprints/solicitud/:notifId/accept
   * Instructor acepta la solicitud de módulo del líder técnico.
   * Crea el sprint automáticamente con los datos de la notificación.
   * IMPORTANTE: va ANTES de :id/solicitar-sprint para evitar conflictos de routing.
   */
  @Post('sprints/solicitud/:notifId/accept')
  acceptSprintSolicitud(
    @Param('notifId', ParseIntPipe) notifId: number,
    @Request() req: any,
  ) {
    const rol = req.user?.rol;
    if (rol !== 'coordinador' && rol !== 'instructor') {
      throw new ForbiddenException('Solo instructores o coordinadores pueden aceptar solicitudes de módulo.');
    }
    return this.projectsService.acceptSprintSolicitud(notifId, req.user.id);
  }

  /**
   * POST /projects/sprints/solicitud/:notifId/reject
   * Instructor rechaza la solicitud de módulo del líder técnico.
   * Body: { motivo?: string }
   */
  @Post('sprints/solicitud/:notifId/reject')
  rejectSprintSolicitud(
    @Param('notifId', ParseIntPipe) notifId: number,
    @Body('motivo') motivo: string,
    @Request() req: any,
  ) {
    const rol = req.user?.rol;
    if (rol !== 'coordinador' && rol !== 'instructor') {
      throw new ForbiddenException('Solo instructores o coordinadores pueden rechazar solicitudes de módulo.');
    }
    return this.projectsService.rejectSprintSolicitud(notifId, req.user.id, motivo || undefined);
  }

  /**
   * POST /projects/:id/solicitar-sprint
   * El líder técnico solicita al instructor que cree un nuevo sprint.
   * Genera una notificación accionable (action_type: 'solicitar_modulo') para el instructor.
   * Body: { nombre: string, justificacion?: string, fecha_inicio?: string, fecha_fin?: string }
   */
  @Post(':id/solicitar-sprint')
  async solicitarSprint(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { nombre: string; justificacion?: string; fecha_inicio?: string; fecha_fin?: string },
    @Request() req: any,
  ) {
    const usuario = req.user;
    const esLider = usuario?.rol === 'aprendiz' && usuario?.es_lider_tecnico === true;

    if (!esLider) {
      throw new ForbiddenException(
        'Solo el líder técnico puede solicitar la creación de un sprint.'
      );
    }

    // Obtener el proyecto para saber quién es el instructor
    const proyecto = await this.projectsService.findOne(id);
    if (!proyecto) {
      throw new ForbiddenException('Proyecto no encontrado.');
    }

    const instructorId = proyecto.instructorId;
    if (!instructorId) {
      throw new ForbiddenException(
        'Este proyecto no tiene instructor asignado aún.'
      );
    }

    // Crear notificación accionable para el instructor (con accept/reject)
    await this.notificationsService.create({
      usuario_id:  instructorId,
      titulo:      `Solicitud de módulo — ${proyecto.nombre}`,
      mensaje:     `El líder técnico ${usuario.nombre} solicita crear el módulo "${body.nombre}".${
        body.justificacion ? ` Justificación: ${body.justificacion}` : ''
      }`,
      tipo:        'info' as any,
      action_type: 'solicitar_modulo',
      action_data: JSON.stringify({
        nombre:       body.nombre,
        justificacion: body.justificacion || '',
        fecha_inicio: body.fecha_inicio  || '',
        fecha_fin:    body.fecha_fin     || '',
        proyecto_id:  id,
        lider_id:     usuario.id,
        lider_nombre: usuario.nombre,
      }),
    });

    return { mensaje: 'Solicitud enviada al instructor correctamente.' };
  }

}