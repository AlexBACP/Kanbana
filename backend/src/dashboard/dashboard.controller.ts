import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DashboardService } from './dashboard.service';

@UseGuards(AuthGuard('jwt'))
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * GET /dashboard/stats
   *
   * ── MODIFICADO ──────────────────────────────────────────────────────────
   * Antes: llamaba getStats() sin parámetros → el servicio no sabía quién
   * era el usuario → devolvía datos globales a todos los roles por igual.
   *
   * Ahora: extrae el usuario del JWT con @Request() y lo pasa al servicio,
   * que aplica los filtros según el rol:
   *   - coordinador     → sin filtros, ve todo el sistema.
   *   - instructor      → solo sus proyectos y sus tickets.
   *   - aprendiz-líder  → solo el proyecto que lidera y sus tickets.
   *   - aprendiz normal → solo sus propios tickets asignados.
   * ────────────────────────────────────────────────────────────────────────
   */
  @Get('stats')
  getStats(@Request() req: any) {
    // req.user lo inyecta JwtStrategy tras validar el token
    return this.dashboardService.getStats(req.user);
  }
}