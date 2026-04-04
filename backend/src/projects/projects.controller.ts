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

  // ── GET /projects — con filtros opcionales ─────────────────────
  @Get()
  findAll(
    @Query('fichaId')      fichaId?:      string,
    @Query('instructorId') instructorId?: string,
    @Query('liderId')      liderId?:      string,
    @Query('miembroId')    miembroId?:    string,
  ) {
    return this.projectsService.findAll({
      fichaId:      fichaId      ? +fichaId      : undefined,
      instructorId: instructorId ? +instructorId : undefined,
      liderId:      liderId      ? +liderId      : undefined,
      miembroId:    miembroId    ? +miembroId    : undefined,
    });
  }

  // ── GET /projects/for-me — proyectos filtrados según rol del usuario ─
  // El frontend de cada rol usa esto en lugar de filtrar manualmente.
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