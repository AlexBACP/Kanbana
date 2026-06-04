import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  UseGuards, Request, UseInterceptors, UploadedFile,
  BadRequestException, ForbiddenException, Res, ParseIntPipe, Query,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { memoryStorage, diskStorage } from 'multer';
import { extname, join }              from 'path';
import { existsSync, mkdirSync }      from 'fs';
import { v4 as uuidv4 }               from 'uuid';
import { FichasService } from './fichas.service';

// ── Configuración de Multer para evidencias de cierre de trimestre ───────────
const evidenciasStorage = diskStorage({
  destination: (req, file, cb) => {
    const dest = join(process.cwd(), 'uploads', 'evidencias');
    if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

@ApiTags('Fichas')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('fichas')
export class FichasController {
  constructor(private readonly fichasService: FichasService) {}

  @Post()
  create(@Body() createFichaDto: any, @Request() req: any) {
    // Solo coordinador o instructor (con permiso vigente) pueden crear fichas.
    const rol = req.user?.rol;
    if (rol !== 'coordinador' && rol !== 'instructor') {
      throw new ForbiddenException('Solo coordinadores e instructores pueden crear fichas.');
    }
    return this.fichasService.create(createFichaDto, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'Lista fichas. Instructor solo ve las suyas.' })
  findAll(@Request() req: any) {
    const user = req.user;
    if (user?.rol === 'instructor') {
      return this.fichasService.findByInstructor(user.id);
    }
    return this.fichasService.findAll();
  }

  @Get('available-users')
  @ApiOperation({ summary: 'Aprendices sin ficha asignada (disponibles para vincular)' })
  getAvailableUsers() {
    return this.fichasService.getAvailableUsers();
  }

  // ── Ruta con prefijo único "download/" para evitar cualquier
  // ambigüedad con rutas dinámicas :id ──────────────────────────────
  @Get('download/template')
  @ApiOperation({ summary: 'Descargar plantilla Excel para importación masiva de aprendices' })
  async downloadTemplate(@Res() res: Response) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const XLSX = require('xlsx');

    const wb = XLSX.utils.book_new();

    const dataRows = [
      ['nombre', 'correo', 'cedula', 'telefono', 'bio'],
      ['Juan Pérez García', 'juan.perez@sena.edu.co', '1234567890', '3001234567', 'Aprendiz ADSO ficha 2850271'],
      ['María López', 'maria.lopez@correo.com', '9876543210', '3107654321', ''],
      ['Carlos Rodríguez', 'carlos.rodriguez@gmail.com', '1122334455', '', ''],
    ];

    const ws = XLSX.utils.aoa_to_sheet(dataRows);
    ws['!cols'] = [{ wch: 30 }, { wch: 35 }, { wch: 15 }, { wch: 15 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Aprendices');

    const instrRows = [
      ['INSTRUCCIONES DE USO - Plantilla importación de aprendices'],
      [''],
      ['COLUMNAS REQUERIDAS:'],
      ['  nombre   (obligatorio)', 'Nombre completo del aprendiz'],
      ['  correo   (obligatorio)', 'Correo electrónico único (se usa para login)'],
      ['  cedula   (obligatorio)', 'Número de documento — se usará como contraseña inicial'],
      [''],
      ['COLUMNAS OPCIONALES:'],
      ['  telefono (opcional)', 'Número de celular del aprendiz'],
      ['  bio      (opcional)', 'Descripción o información adicional'],
      [''],
      ['NOTAS IMPORTANTES:'],
      ['  • La contraseña inicial de cada aprendiz es su número de cédula/documento'],
      ['  • Se enviará un correo de confirmación a cada aprendiz importado'],
      ['  • Si el correo ya existe en el sistema, el aprendiz será vinculado sin cambiar su contraseña'],
      ['  • Si el aprendiz ya pertenece a otra ficha, se registrará como error en esa fila'],
      ['  • Los encabezados deben estar exactamente en la primera fila (nombre, correo, telefono, bio)'],
      ['  • El archivo puede ser .xlsx o .xls'],
    ];

    const wsInstr = XLSX.utils.aoa_to_sheet(instrRows);
    wsInstr['!cols'] = [{ wch: 50 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, wsInstr, 'Instrucciones');

    const buffer: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla_aprendices.xlsx"');
    res.send(buffer);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PLANTILLA SDLC — preview y sugerencias de módulos
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * GET /fichas/plantilla?tipo=tecnologo|tecnico
   * Devuelve la plantilla SDLC con los trimestres y módulos predeterminados
   * que se generarán al crear una ficha de ese tipo. El frontend usa esto
   * para mostrar un preview antes de guardar.
   */
  @Get('plantilla')
  @ApiOperation({ summary: 'Preview de la plantilla SDLC según el tipo de formación' })
  getPlantilla(@Query('tipo') tipo: string) {
    return this.fichasService.getPlantilla(tipo);
  }

  /**
   * GET /fichas/sugerencias-modulos?trimestre=N&categoria=Documentación
   * Devuelve sugerencias de módulos adicionales (fuera de la plantilla base)
   * relevantes para un trimestre dado. Filtro opcional por categoría.
   */
  @Get('sugerencias-modulos')
  @ApiOperation({ summary: 'Sugerencias de módulos adicionales según trimestre y categoría' })
  getSugerenciasModulos(
    @Query('trimestre') trimestre: string,
    @Query('categoria') categoria?: string,
  ) {
    const num = Number(trimestre);
    if (!num || num < 1) {
      throw new BadRequestException('Parámetro "trimestre" requerido (1..N).');
    }
    return this.fichasService.getSugerenciasModulos(num, categoria);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FLUJO ANTIGUO DE SOLICITUD DE PERMISO — DEPRECADO
  // El instructor ahora crea fichas directamente sin pedir permiso.
  // Estos endpoints se mantienen como no-op para no romper notificaciones
  // antiguas en BD ni clientes desactualizados. Pueden eliminarse en una
  // siguiente iteración tras limpiar las notificaciones legacy.
  // ══════════════════════════════════════════════════════════════════════════

  @Post('solicitar-crear')
  @ApiOperation({ summary: '[DEPRECADO] Solicitud de permiso (ya no requerido)' })
  solicitarCrear() {
    return { message: 'El instructor ya puede crear fichas directamente. Este endpoint ya no es necesario.' };
  }

  @Get('permiso-crear')
  @ApiOperation({ summary: '[DEPRECADO] El permiso ya no es necesario; siempre retorna puede_crear:true' })
  getPermisoCrear() {
    return { puede_crear: true, solicitud_pendiente: false };
  }

  @Post('responder-solicitud')
  @ApiOperation({ summary: '[DEPRECADO] Aprobación coordinador (flujo eliminado)' })
  responderSolicitud(
    @Body() body: { instructorId: number; aprobada: boolean; motivo?: string },
    @Request() req: any,
  ) {
    if (req.user?.rol !== 'coordinador') {
      throw new ForbiddenException('Solo el coordinador puede responder solicitudes.');
    }
    // Limpiar notificaciones legacy y avisar al instructor
    return this.fichasService.notificarRespuestaFicha(
      body.instructorId,
      body.aprobada,
      body.motivo,
    ).then(() => ({
      message: 'Solicitud procesada (flujo legacy).',
    }));
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.fichasService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateFichaDto: any) {
    return this.fichasService.update(+id, updateFichaDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.fichasService.remove(+id);
  }

  // ── Gestión de aprendices vinculados a la ficha ──────────────────────

  @Get(':id/members')
  @ApiOperation({ summary: 'Lista de aprendices/líderes vinculados a esta ficha' })
  getMembers(@Param('id') id: string) {
    return this.fichasService.getMembers(+id);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Añadir uno o varios aprendices a la ficha en una sola operación' })
  addMembers(@Param('id') id: string, @Body() body: { userIds: number[] }) {
    return this.fichasService.addMembers(+id, body.userIds);
  }

  @Post(':id/members/import-excel')
  @ApiOperation({ summary: 'Importar aprendices desde Excel. Contraseña predeterminada: Sena2025*' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async importFromExcel(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo');
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv',
      'text/plain',
    ];
    if (!allowed.includes(file.mimetype) && !file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
      throw new BadRequestException('Solo se aceptan archivos .xlsx, .xls o .csv');
    }
    return this.fichasService.importFromExcel(+id, file.buffer, file.originalname, req.user?.id);
  }

  // ── POST /fichas/validar-correos ──────────────────────────────────────────
  // Valida formato + existencia de MX del dominio de una lista de correos.
  // Lo usa el preview del frontend para avisar qué correos NO podrán recibir
  // el email de confirmación (dominio inexistente o mal escrito) ANTES de importar.
  @Post('validar-correos')
  @ApiOperation({ summary: 'Valida formato y MX de dominio de una lista de correos' })
  validarCorreos(@Body('correos') correos: string[]) {
    return this.fichasService.validarCorreos(correos ?? []);
  }

  @Delete(':id/members')
  @ApiOperation({ summary: 'Desvincular múltiples aprendices de la ficha en masa' })
  removeMembers(@Param('id') id: string, @Body() body: { userIds: number[] }) {
    return this.fichasService.removeMembers(+id, body.userIds);
  }

  @Delete(':id/members/:userId')
  @ApiOperation({ summary: 'Desvincular aprendiz de la ficha' })
  removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.fichasService.removeMember(+id, +userId);
  }

  @Patch(':id/members/:userId/promote')
  @ApiOperation({ summary: 'Promover aprendiz a líder técnico dentro de esta ficha' })
  promoteToLider(@Param('id') id: string, @Param('userId') userId: string) {
    return this.fichasService.promoteToLider(+id, +userId);
  }

  @Patch(':id/members/:userId/demote')
  @ApiOperation({ summary: 'Degradar líder técnico a aprendiz dentro de esta ficha' })
  demoteToAprendiz(@Param('id') id: string, @Param('userId') userId: string) {
    return this.fichasService.demoteToAprendiz(+id, +userId);
  }

  // ── Invitación individual con correo ─────────────────────────────────────

  @Post(':id/aprendices/invitar')
  @ApiOperation({ summary: 'Crear aprendiz individual: contraseña = cédula, envía correo de confirmación' })
  inviteAprendiz(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { nombre: string; correo: string; documento: string },
  ) {
    return this.fichasService.inviteAprendiz(id, body);
  }

  @Post(':id/aprendices/:userId/reenviar')
  @ApiOperation({ summary: 'Reenviar correo de confirmación a un aprendiz pendiente' })
  resendInvitation(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.fichasService.resendInvitation(id, userId);
  }

  // ── Trimestres de la ficha ────────────────────────────────────────────────

  @Get(':id/trimestres')
  getTrimestres(@Param('id', ParseIntPipe) id: number) {
    return this.fichasService.getTrimestres(id);
  }

  @Post(':id/trimestres/generate')
  generateTrimestres(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { num: number; trimestres?: any[] },
  ) {
    return this.fichasService.generateTrimestres(id, dto);
  }

  @Patch('trimestres/:tid')
  updateTrimestre(
    @Param('tid', ParseIntPipe) tid: number,
    @Body() dto: any,
  ) {
    return this.fichasService.updateTrimestre(tid, dto);
  }

  // ── Subir UNA evidencia (puede usarse independiente del wizard) ─────────────
  // Devuelve { url, nombre } que el frontend reusará al llamar declarar-historico.
  @Post('upload-evidencia')
  @ApiOperation({ summary: 'Sube un archivo y devuelve su URL pública (para evidencias de cierre)' })
  @UseInterceptors(FileInterceptor('file', { storage: evidenciasStorage }))
  uploadEvidencia(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No se recibió archivo.');
    return {
      url:    `/uploads/evidencias/${file.filename}`,
      nombre: file.originalname,
      mime:   file.mimetype,
      size:   file.size,
    };
  }

  // ── Declarar trimestres históricos en bloque ────────────────────────────────
  @Post(':id/declarar-historico')
  @ApiOperation({ summary: 'Declara los trimestres anteriores de una ficha que ya estaba en curso' })
  declararHistorico(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: {
      trimestre_actual: number;
      anteriores: Array<{
        numero: number; nombre?: string;
        fecha_inicio?: string; fecha_fin?: string;
        evidencia_url?: string; evidencia_nombre?: string;
      }>;
    },
    @Request() req: any,
  ) {
    return this.fichasService.declararTrimestresHistoricos(id, req.user, dto);
  }

  // ── Adjuntar/reemplazar evidencia a UN trimestre histórico ──────────────────
  @Patch('trimestres/:tid/evidencia')
  @ApiOperation({ summary: 'Adjunta o reemplaza la evidencia de cierre de un trimestre histórico' })
  @UseInterceptors(FileInterceptor('file', { storage: evidenciasStorage }))
  adjuntarEvidencia(
    @Param('tid', ParseIntPipe) tid: number,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    if (!file) throw new BadRequestException('No se recibió archivo.');
    const url = `/uploads/evidencias/${file.filename}`;
    return this.fichasService.adjuntarEvidenciaTrimestre(tid, req.user, url, file.originalname);
  }
}