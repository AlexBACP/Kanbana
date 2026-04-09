import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  UseGuards, ParseIntPipe, Query, Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProjectsService } from './projects.service';

@Controller('projects')
@UseGuards(AuthGuard('jwt'))
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

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

  // ── GET /projects/for-me — alias explícito para compatibilidad ────────
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
  assignLider(@Param('id', ParseIntPipe) id: number, @Body('liderId') liderId: number) {
    return this.projectsService.assignLider(id, liderId);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
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

  @Get(':id/burnup')
  getBurnup(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.getBurnupStats(id);
  }
}
