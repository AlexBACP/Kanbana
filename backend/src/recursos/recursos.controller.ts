import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, UseGuards, ParseIntPipe, Request, ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RecursosService } from './recursos.service';

/**
 * RecursosController
 *
 * Base: /projects/:proyectoId/recursos
 *
 * GET    /                       → listar recursos del proyecto
 * POST   /                       → crear recurso (tipo auto-detectado desde URL)
 * PATCH  /:id                    → editar nombre/url/descripcion/orden
 * DELETE /:id                    → eliminar
 * PATCH  /:id/token              → guardar token privado de GitHub (select:false)
 * GET    /:id/github             → proxy GitHub API → datos en vivo del repo
 */
@Controller('projects/:proyectoId/recursos')
@UseGuards(AuthGuard('jwt'))
export class RecursosController {
  constructor(private readonly svc: RecursosService) {}

  @Get()
  findAll(@Param('proyectoId', ParseIntPipe) proyectoId: number) {
    return this.svc.findAll(proyectoId);
  }

  @Post()
  create(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Body() dto: any,
    @Request() req: any,
  ) {
    const usuario = req.user;
    const esLider = usuario?.rol === 'aprendiz' && usuario?.es_lider_tecnico === true;
    if (usuario?.rol !== 'coordinador' && usuario?.rol !== 'instructor' && !esLider) {
      throw new ForbiddenException('Solo coordinadores, instructores o el líder técnico pueden añadir recursos.');
    }
    return this.svc.create(proyectoId, dto, usuario?.id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: any,
    @Request() req: any,
  ) {
    const usuario = req.user;
    const esLider = usuario?.rol === 'aprendiz' && usuario?.es_lider_tecnico === true;
    if (usuario?.rol !== 'coordinador' && usuario?.rol !== 'instructor' && !esLider) {
      throw new ForbiddenException('Solo coordinadores, instructores o el líder técnico pueden editar recursos.');
    }
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    const usuario = req.user;
    const esLider = usuario?.rol === 'aprendiz' && usuario?.es_lider_tecnico === true;
    if (usuario?.rol !== 'coordinador' && usuario?.rol !== 'instructor' && !esLider) {
      throw new ForbiddenException('Solo coordinadores, instructores o el líder técnico pueden eliminar recursos.');
    }
    return this.svc.remove(id);
  }

  @Patch(':id/token')
  saveToken(
    @Param('id', ParseIntPipe) id: number,
    @Body('token') token: string,
    @Request() req: any,
  ) {
    const rol = req.user?.rol;
    if (rol !== 'coordinador' && rol !== 'instructor') {
      throw new ForbiddenException('Solo coordinadores e instructores pueden guardar tokens de GitHub.');
    }
    return this.svc.saveToken(id, token);
  }

  @Get(':id/github')
  getGitHubData(@Param('id', ParseIntPipe) id: number) {
    return this.svc.getGitHubData(id);
  }
}
