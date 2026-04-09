import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  UseGuards, ParseIntPipe, Query, Request,
  UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { UsersService } from './users.service';

// Asegurar que el directorio de uploads existe
const uploadsDir = path.join(process.cwd(), 'uploads', 'avatars');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const avatarStorage = diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `avatar-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

@UseGuards(AuthGuard('jwt'))
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ── GET /users ───────────────────────────────────────────────────────
  @Get()
  findAll(@Query('rol') rol?: string) {
    return this.usersService.findAll(rol);
  }

  // ── GET /users/me/context ────────────────────────────────────────────
  @Get('me/context')
  getMyContext(@Request() req: any) {
    return this.usersService.findContextual(req.user);
  }

  // ── GET /users/by-ficha/:fichaId ─────────────────────────────────────
  @Get('by-ficha/:fichaId')
  findByFicha(@Param('fichaId', ParseIntPipe) fichaId: number) {
    return this.usersService.findByFicha(fichaId);
  }

  // ── GET /users/by-proyecto/:proyectoId ───────────────────────────────
  @Get('by-proyecto/:proyectoId')
  findByProyecto(@Param('proyectoId', ParseIntPipe) proyectoId: number) {
    return this.usersService.findByProyecto(proyectoId);
  }

  // ── GET /users/leaders/:id/stats ─────────────────────────────────────
  @Get('leaders/:id/stats')
  getLeaderStats(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getLeaderStats(id);
  }

  // ── GET /users/leaders/:id/team ──────────────────────────────────────
  @Get('leaders/:id/team')
  getLeaderTeam(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getLeaderTeam(id);
  }

  // ── GET /users/:id/profile — perfil completo enriquecido ─────────────
  // Devuelve: datos + fichas + proyectos + tickets según rol del target
  @Get(':id/profile')
  getFullProfile(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getFullProfile(id);
  }

  // ── GET /users/:id ────────────────────────────────────────────────────
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  // ── POST /users ───────────────────────────────────────────────────────
  @Post()
  create(@Body() createUserDto: any) {
    return this.usersService.create(createUserDto);
  }

  // ── POST /users/:id/avatar — upload de foto de perfil ────────────────
  @Post(':id/avatar')
  @UseInterceptors(FileInterceptor('avatar', {
    storage: avatarStorage,
    limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
    fileFilter: (_req, file, cb) => {
      const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
      const ext = path.extname(file.originalname).toLowerCase();
      if (!allowed.includes(ext)) {
        return cb(new Error('Solo se permiten imágenes (jpg, png, webp, gif)'), false);
      }
      cb(null, true);
    },
  }))
  uploadAvatar(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.usersService.updateAvatar(id, file);
  }

  // ── PATCH /users/:id ──────────────────────────────────────────────────
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateUserDto: any) {
    return this.usersService.update(id, updateUserDto);
  }

  // ── PATCH /users/:id/role ─────────────────────────────────────────────
  @Patch(':id/role')
  updateRole(@Param('id', ParseIntPipe) id: number, @Body('rol') rol: any) {
    return this.usersService.updateRole(id, rol);
  }

  // ── PATCH /users/:id/toggle ───────────────────────────────────────────
  @Patch(':id/toggle')
  toggleActive(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.toggleActive(id);
  }

  // ── PATCH /users/:id/password/own — el usuario cambia su propia contraseña ─
  @Patch(':id/password/own')
  changeOwnPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { actual: string; nueva: string },
  ) {
    return this.usersService.changeOwnPassword(id, body.actual, body.nueva);
  }

  // ── PATCH /users/:id/password/admin — admin/instructor cambia contraseña ajena ─
  @Patch(':id/password/admin')
  changePasswordAsAdmin(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body('nueva') nueva: string,
  ) {
    return this.usersService.changePasswordAsAdmin(req.user, id, nueva);
  }

  // ── DELETE /users/:id ─────────────────────────────────────────────────
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }
}
