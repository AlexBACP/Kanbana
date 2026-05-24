import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  UseGuards, ParseIntPipe, Query, Request, ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProjectsService } from './projects.service';
import { NotificationsService } from '../notifications/notifications.service';

@Controller('projects')
@UseGuards(AuthGuard('jwt'))
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly notificationsService: NotificationsService,
  ) {}

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
  bulkGenerateTrimestres(@Body() dto: { projectIds: number[]; num: number; trimestres?: any[] }) {
    return this.projectsService.bulkGenerateTrimestres(dto);
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
  create(@Body() dto: any) {
    return this.projectsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: any) {
    return this.projectsService.update(id, dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id', ParseIntPipe) id: number, @Body('estado') estado: string) {
    return this.projectsService.updateStatus(id, estado);
  }

  @Patch(':id/assign-lider')
  assignLider(
    @Param('id', ParseIntPipe) id: number,
    @Body('liderId') liderId: number | null,
    @Request() req: any,
  ) {
    return this.projectsService.assignLider(id, liderId ?? null, req.user.id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    // Solo el coordinador puede eliminar proyectos
    if (req.user?.rol !== 'coordinador') {
      throw new ForbiddenException('Solo el coordinador puede eliminar proyectos');
    }
    return this.projectsService.remove(id);
  }

  @Get(':id/members')
  getMembers(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.getMembers(id);
  }

  @Post(':id/members')
  addMember(@Param('id', ParseIntPipe) id: number, @Body('userId') userId: number) {
    return this.projectsService.addMember(id, userId);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
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
  createSprint(@Param('id', ParseIntPipe) id: number, @Body() dto: any) {
    return this.projectsService.createSprint(id, dto);
  }

  @Patch('sprints/:sprintId')
  updateSprint(
    @Param('sprintId', ParseIntPipe) sprintId: number,
    @Body() dto: any,
  ) {
    return this.projectsService.updateSprint(sprintId, dto);
  }

  @Patch('sprints/:sprintId/start')
  startSprint(@Param('sprintId', ParseIntPipe) sprintId: number) {
    return this.projectsService.startSprint(sprintId);
  }

  @Patch('sprints/:sprintId/close')
  closeSprint(@Param('sprintId', ParseIntPipe) sprintId: number) {
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
  ) {
    return this.projectsService.updateTrimestre(tid, dto);
  }

  // PATCH /projects/sprints/:sprintId/assign-trimestre
  // Vincula un sprint a un trimestre (o lo desvincula con trimestreId: null).
  // Body: { trimestreId: number | null }
  @Patch('sprints/:sprintId/assign-trimestre')
  assignSprintToTrimestre(
    @Param('sprintId', ParseIntPipe) sprintId: number,
    @Body('trimestreId') trimestreId: number | null,
  ) {
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
    return this.projectsService.solicitarRevisionSprint(sprintId, req.user.id);
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
    if (!mensaje?.trim()) {
      throw new Error('Debes indicar el motivo de las correcciones.');
    }
    return this.projectsService.solicitarCorreccionesSprint(sprintId, req.user.id, mensaje);
  }

  /**
   * POST /projects/:id/solicitar-sprint
   * El líder técnico solicita al instructor que cree un nuevo sprint.
   * Genera una notificación para el instructor del proyecto.
   * Body: { nombre: string, justificacion?: string }
   */
  @Post(':id/solicitar-sprint')
  async solicitarSprint(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { nombre: string; justificacion?: string },
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

    // Crear notificación para el instructor
    await this.notificationsService.create({
      usuario_id: instructorId,
      titulo: `Solicitud de sprint — ${proyecto.nombre}`,
      mensaje: `El líder técnico ${usuario.nombre} solicita crear el sprint "${body.nombre}".${
        body.justificacion ? ` Justificación: ${body.justificacion}` : ''
      }`,
      tipo: 'info' as any,
    });

    return { mensaje: 'Solicitud enviada al instructor correctamente.' };
  }

}