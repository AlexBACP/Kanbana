import {
  Controller, Post, Get, Param, Body,
  UseGuards, Request, ParseIntPipe, Query, ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermisosService } from './permisos.service';
import { TipoPermiso } from './entities/permiso-temporal.entity';

@UseGuards(AuthGuard('jwt'))
@Controller('permisos')
export class PermisosController {
  constructor(private readonly permisosService: PermisosService) {}

  /**
   * POST /permisos/solicitar
   * El líder técnico solicita un permiso al instructor.
   * Body: { proyectoId, instructorId, tipo, justificacion? }
   */
  @Post('solicitar')
  solicitar(
    @Body() body: {
      proyectoId:    number;
      instructorId:  number;
      tipo:          TipoPermiso;
      justificacion?: string;
    },
    @Request() req: any,
  ) {
    return this.permisosService.solicitar(
      req.user.id,
      body.proyectoId,
      body.instructorId,
      body.tipo,
      body.justificacion,
    );
  }

  /**
   * POST /permisos/:id/aceptar
   * El instructor acepta la solicitud con N días de permiso.
   * Body: { dias } (mínimo 5)
   */
  @Post(':id/aceptar')
  aceptar(
    @Param('id', ParseIntPipe) id: number,
    @Body('dias') dias: number,
    @Request() req: any,
  ) {
    const rol = req.user?.rol;
    if (rol !== 'coordinador' && rol !== 'instructor') {
      throw new ForbiddenException('Solo instructores o coordinadores pueden aceptar permisos.');
    }
    return this.permisosService.aceptar(id, req.user.id, dias ?? 5);
  }

  /**
   * POST /permisos/:id/rechazar
   * El instructor rechaza la solicitud.
   * Body: { motivo? }
   */
  @Post(':id/rechazar')
  rechazar(
    @Param('id', ParseIntPipe) id: number,
    @Body('motivo') motivo: string,
    @Request() req: any,
  ) {
    const rol = req.user?.rol;
    if (rol !== 'coordinador' && rol !== 'instructor') {
      throw new ForbiddenException('Solo instructores o coordinadores pueden rechazar permisos.');
    }
    return this.permisosService.rechazar(id, req.user.id, motivo);
  }

  /**
   * GET /permisos/verificar?proyectoId=X&tipo=Y
   * El frontend verifica si el líder tiene permiso vigente.
   * Devuelve { tiene: boolean, expira_en: Date | null }
   */
  @Get('verificar')
  verificar(
    @Query('proyectoId', ParseIntPipe) proyectoId: number,
    @Query('tipo') tipo: TipoPermiso,
    @Request() req: any,
  ) {
    return this.permisosService.verificar(req.user.id, proyectoId, tipo);
  }

  /**
   * GET /permisos/pendientes
   * Lista solicitudes pendientes para el instructor autenticado.
   */
  @Get('pendientes')
  pendientes(@Request() req: any) {
    return this.permisosService.pendientesParaInstructor(req.user.id);
  }
}