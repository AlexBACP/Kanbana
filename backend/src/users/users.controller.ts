import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  UseGuards, ParseIntPipe, Query, Request,
  UseInterceptors, UploadedFile, ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { UsersService } from './users.service';

// Asegurar que los directorios de uploads existen
const uploadsDir = path.join(process.cwd(), 'uploads', 'avatars');
const bannersDir = path.join(process.cwd(), 'uploads', 'banners');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(bannersDir)) fs.mkdirSync(bannersDir, { recursive: true });

const avatarStorage = diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `avatar-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const bannerStorage = diskStorage({
  destination: bannersDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `banner-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
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

  // ── GET /users/me/dashboard-context ──────────────────────────────────
  // Contexto enriquecido para aprendices y líderes técnicos: ficha,
  // instructor, proyecto, sprint activo, líder técnico del proyecto.
  @Get('me/dashboard-context')
  getMyDashboardContext(@Request() req: any) {
    return this.usersService.getDashboardContext(req.user.id);
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
  // Solo coordinador o instructor pueden crear usuarios.
  // El instructor solo puede crear aprendices.
  @Post()
  create(@Body() createUserDto: any, @Request() req: any) {
    const rol = req.user?.rol;
    if (rol !== 'coordinador' && rol !== 'instructor') {
      throw new ForbiddenException('Solo coordinadores e instructores pueden crear usuarios.');
    }
    // El instructor no puede crear coordinadores ni otros instructores
    if (rol === 'instructor' && createUserDto.rol && createUserDto.rol !== 'aprendiz') {
      throw new ForbiddenException('El instructor solo puede crear cuentas de aprendiz.');
    }
    return this.usersService.create(createUserDto);
  }

  // ── POST /users/:id/avatar — upload de foto de perfil ────────────────
  @Post(':id/avatar')
  @UseInterceptors(FileInterceptor('avatar', {
    storage: avatarStorage,
    limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
    fileFilter: (_req, file, cb) => {
      // Validar por mimetype (más fiable que la extensión: cubre fotos de
      // celular, blobs recortados y archivos sin extensión).
      const okMime = (file.mimetype || '').toLowerCase().startsWith('image/');
      const allowedExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.jfif', '.avif', '.heic', '.heif', '.bmp'];
      const ext = path.extname(file.originalname || '').toLowerCase();
      if (!okMime && !allowedExt.includes(ext)) {
        return cb(new Error('Solo se permiten imágenes (jpg, png, webp, gif, etc.)'), false);
      }
      cb(null, true);
    },
  }))
  uploadAvatar(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    // Solo el propio usuario o un coordinador puede subir avatar de otro id
    if (req.user?.id !== id && req.user?.rol !== 'coordinador') {
      throw new ForbiddenException('Solo puedes cambiar tu propio avatar.');
    }
    return this.usersService.updateAvatar(id, file);
  }

  // ── POST /users/:id/banner — upload de foto de portada ──────────────────
  @Post(':id/banner')
  @UseInterceptors(FileInterceptor('banner', {
    storage: bannerStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (_req, file, cb) => {
      const okMime = (file.mimetype || '').toLowerCase().startsWith('image/');
      const allowedExt = ['.jpg', '.jpeg', '.png', '.webp', '.jfif', '.avif', '.heic', '.heif', '.bmp'];
      const ext = path.extname(file.originalname || '').toLowerCase();
      if (!okMime && !allowedExt.includes(ext)) {
        return cb(new Error('Solo se permiten imágenes (jpg, png, webp, etc.)'), false);
      }
      cb(null, true);
    },
  }))
  uploadBanner(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    // Solo el propio usuario o un coordinador puede subir banner de otro id
    if (req.user?.id !== id && req.user?.rol !== 'coordinador') {
      throw new ForbiddenException('Solo puedes cambiar tu propio banner.');
    }
    return this.usersService.updateBanner(id, file);
  }

  // ── PATCH /users/:id ──────────────────────────────────────────────────
  // El propio usuario puede editar sus datos personales.
  // El coordinador puede editar cualquier usuario.
  // El instructor puede editar aprendices de sus fichas (validado en el service).
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: any,
    @Request() req: any,
  ) {
    const rol = req.user?.rol;
    const esPropio = req.user?.id === id;
    if (!esPropio && rol !== 'coordinador' && rol !== 'instructor') {
      throw new ForbiddenException('No tienes permisos para editar este usuario.');
    }
    // El instructor no puede cambiar roles a través de este endpoint (usar /role).
    // Un usuario editando lo suyo tampoco puede cambiarse el rol.
    if (!esPropio && rol === 'instructor' && updateUserDto.rol) {
      throw new ForbiddenException('Solo el coordinador puede cambiar roles.');
    }
    if (esPropio && updateUserDto.rol && rol !== 'coordinador') {
      throw new ForbiddenException('No puedes cambiar tu propio rol.');
    }
    return this.usersService.update(id, updateUserDto);
  }

  // ── PATCH /users/:id/role ─────────────────────────────────────────────
  // Solo el coordinador puede cambiar roles.
  // Cambiar a 'coordinador' requiere que el requestor sea coordinador.
  @Patch(':id/role')
  updateRole(
    @Param('id', ParseIntPipe) id: number,
    @Body('rol') rol: any,
    @Request() req: any,
  ) {
    // Solo coordinadores pueden cambiar roles
    if (req.user?.rol !== 'coordinador') {
      throw new ForbiddenException('Solo el coordinador puede cambiar roles de usuario');
    }
    return this.usersService.updateRole(id, rol);
  }

  // ── PATCH /users/:id/toggle-lider — activa/desactiva sub-rol líder técnico ─
  // Solo aplica a aprendices. El rol base NO cambia.
  @Patch(':id/toggle-lider')
  toggleLiderTecnico(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
  ) {
    // Coordinador e instructor pueden asignar sub-rol
    if (req.user?.rol !== 'coordinador' && req.user?.rol !== 'instructor') {
      throw new ForbiddenException('Solo coordinadores e instructores pueden asignar el sub-rol de Líder Técnico');
    }
    return this.usersService.toggleLiderTecnico(id);
  }

  // ── PATCH /users/:id/toggle ───────────────────────────────────────────
  // Activar/desactivar cuentas: solo coordinador.
  @Patch(':id/toggle')
  toggleActive(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    if (req.user?.rol !== 'coordinador') {
      throw new ForbiddenException('Solo el coordinador puede activar/desactivar usuarios.');
    }
    return this.usersService.toggleActive(id);
  }

  // ── PATCH /users/:id/confirm-account ─────────────────────────────────
  // Coordinador: confirma cualquier cuenta.
  // Instructor: solo puede confirmar aprendices de sus propias fichas.
  @Patch(':id/confirm-account')
  confirmAccountByAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
  ) {
    const rol = req.user?.rol;
    if (rol !== 'coordinador' && rol !== 'instructor') {
      throw new ForbiddenException('Solo coordinadores e instructores pueden confirmar cuentas');
    }
    // Pasar instructorId solo cuando es instructor — el servicio valida la pertenencia a su ficha
    const instructorId = rol === 'instructor' ? req.user.id : undefined;
    return this.usersService.confirmAccountByAdmin(id, instructorId);
  }

  // ── POST /users/bulk-confirm ──────────────────────────────────────────
  // Confirmación masiva de cuentas: útil para entornos de prueba o
  // cuando los aprendices fueron importados con correos no reales.
  // Coordinador e instructor pueden usar esto sobre sus aprendices.
  @Post('bulk-confirm')
  bulkConfirmAccounts(
    @Body() body: { userIds: number[] },
    @Request() req: any,
  ) {
    const rol = req.user?.rol;
    if (rol !== 'coordinador' && rol !== 'instructor') {
      throw new ForbiddenException('Solo coordinadores e instructores pueden confirmar cuentas');
    }
    return this.usersService.confirmAccountsBulk(body.userIds);
  }

  // ── POST /users/me/set-password — crear contraseña por primera vez (OAuth) ─
  // No requiere contraseña actual. Solo permitido si el usuario no tiene una propia.
  @Post('me/set-password')
  setInitialPassword(@Body('nueva') nueva: string, @Request() req: any) {
    return this.usersService.setInitialPassword(req.user.id, nueva);
  }

  // ── PATCH /users/:id/password/own — el usuario cambia su propia contraseña ─
  @Patch(':id/password/own')
  changeOwnPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { actual: string; nueva: string },
    @Request() req: any,
  ) {
    // Validar que el usuario solo cambie SU propia contraseña.
    // Sin esta validación, conociendo la contraseña actual de otro, podrías
    // cambiarla. Aunque bcrypt protege parcialmente, igual debe restringirse.
    if (req.user?.id !== id) {
      throw new ForbiddenException('Solo puedes cambiar tu propia contraseña.');
    }
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
  // Solo coordinador puede eliminar usuarios. Nunca a sí mismo.
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    if (req.user?.rol !== 'coordinador') {
      throw new ForbiddenException('Solo el coordinador puede eliminar usuarios.');
    }
    if (req.user?.id === id) {
      throw new ForbiddenException('No puedes eliminar tu propia cuenta.');
    }
    return this.usersService.remove(id);
  }

  // ════════════════════════════════════════════════════════════════════════
  // VINCULACIÓN DE APRENDICES AUTO-REGISTRADOS A UNA FICHA
  // ════════════════════════════════════════════════════════════════════════

  /**
   * POST /users/me/solicitar-vinculacion
   * El aprendiz autenticado indica código de ficha + jornada + documento.
   * Si todo coincide, queda en estado "pendiente" hasta que el instructor apruebe.
   */
  @Post('me/solicitar-vinculacion')
  solicitarVinculacion(
    @Body() body: { codigoFicha: string; jornada: 'mañana' | 'tarde' | 'noche'; documento: string },
    @Request() req: any,
  ) {
    return this.usersService.solicitarVinculacion(req.user.id, body as any);
  }

  /**
   * GET /fichas/:fichaId/solicitudes-pendientes
   * Lista las solicitudes pendientes de una ficha.
   * Solo el instructor de la ficha o el coordinador.
   * NOTA: ruta declarada en users.controller para mantener Service acá.
   */
  @Get('solicitudes-pendientes/ficha/:fichaId')
  listarSolicitudesPendientes(
    @Param('fichaId', ParseIntPipe) fichaId: number,
    @Request() req: any,
  ) {
    return this.usersService.listarSolicitudesPendientes(fichaId, req.user);
  }

  /**
   * PATCH /users/:id/aprobar-vinculacion
   * Instructor (de la ficha) o coordinador aprueba la solicitud.
   */
  @Patch(':id/aprobar-vinculacion')
  aprobarVinculacion(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
  ) {
    if (req.user?.rol !== 'coordinador' && req.user?.rol !== 'instructor') {
      throw new ForbiddenException('Solo instructores o coordinador pueden aprobar.');
    }
    return this.usersService.aprobarVinculacion(id, req.user);
  }

  /**
   * PATCH /users/:id/rechazar-vinculacion
   * body: { motivo?: string }
   */
  @Patch(':id/rechazar-vinculacion')
  rechazarVinculacion(
    @Param('id', ParseIntPipe) id: number,
    @Body('motivo') motivo: string | undefined,
    @Request() req: any,
  ) {
    if (req.user?.rol !== 'coordinador' && req.user?.rol !== 'instructor') {
      throw new ForbiddenException('Solo instructores o coordinador pueden rechazar.');
    }
    return this.usersService.rechazarVinculacion(id, motivo, req.user);
  }

}
