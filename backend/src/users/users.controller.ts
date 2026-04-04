import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  UseGuards, ParseIntPipe, Query, Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';

@UseGuards(AuthGuard('jwt'))
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ── GET /users — lista según rol del solicitante ───────────────────
  // coordinador → todos | instructor → sus fichas | líder → su proyecto
  @Get()
  findAll(@Query('rol') rol?: string) {
    return this.usersService.findAll(rol);
  }

  // ── GET /users/me/context — usuarios visibles para el usuario actual ─
  // El frontend usa esto para poblar sus listas sin filtrar manualmente
  @Get('me/context')
  getMyContext(@Request() req: any) {
    return this.usersService.findContextual(req.user);
  }

  // ── GET /users/by-ficha/:fichaId ─────────────────────────────────
  @Get('by-ficha/:fichaId')
  findByFicha(@Param('fichaId', ParseIntPipe) fichaId: number) {
    return this.usersService.findByFicha(fichaId);
  }

  // ── GET /users/by-proyecto/:proyectoId ───────────────────────────
  @Get('by-proyecto/:proyectoId')
  findByProyecto(@Param('proyectoId', ParseIntPipe) proyectoId: number) {
    return this.usersService.findByProyecto(proyectoId);
  }

  // ── GET /users/:id ───────────────────────────────────────────────
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  // ── POST /users ──────────────────────────────────────────────────
  @Post()
  create(@Body() createUserDto: any) {
    return this.usersService.create(createUserDto);
  }

  // ── PATCH /users/:id ─────────────────────────────────────────────
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateUserDto: any) {
    return this.usersService.update(id, updateUserDto);
  }

  // ── PATCH /users/:id/role ─────────────────────────────────────────
  @Patch(':id/role')
  updateRole(@Param('id', ParseIntPipe) id: number, @Body('rol') rol: any) {
    return this.usersService.updateRole(id, rol);
  }

  // ── PATCH /users/:id/toggle ──────────────────────────────────────
  @Patch(':id/toggle')
  toggleActive(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.toggleActive(id);
  }

  // ── DELETE /users/:id ────────────────────────────────────────────
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }

  // ── GET /users/leaders/:id/stats ─────────────────────────────────
  @Get('leaders/:id/stats')
  getLeaderStats(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getLeaderStats(id);
  }

  // ── GET /users/leaders/:id/team ──────────────────────────────────
  @Get('leaders/:id/team')
  getLeaderTeam(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getLeaderTeam(id);
  }
}