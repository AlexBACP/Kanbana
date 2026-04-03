import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  UseGuards, ParseIntPipe
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProjectsService } from './projects.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  findAll() {
    return this.projectsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.findOne(id);
  }

  @Post()
  create(@Body() createProjectDto: any) {
    return this.projectsService.create(createProjectDto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateProjectDto: any) {
    return this.projectsService.update(id, updateProjectDto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('estado') estado: 'activo' | 'pausado' | 'finalizado',
  ) {
    return this.projectsService.update(id, { estado });
  }

  @Patch(':id/reassign')
  reassignLeader(
    @Param('id', ParseIntPipe) id: number,
    @Body('liderId') liderId: number,
  ) {
    return this.projectsService.update(id, { lider_id: liderId });
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.remove(id);
  }

  // Sprints
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

  @Get(':id/stats/velocity')
  getVelocity(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.getVelocityStats(id);
  }

  @Get(':id/stats/burnup')
  getBurnup(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.getBurnupStats(id);
  }
}
