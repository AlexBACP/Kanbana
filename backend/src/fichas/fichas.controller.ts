import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  UseGuards, Request, UseInterceptors, UploadedFile,
  BadRequestException, Res, ParseIntPipe,

} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { FichasService } from './fichas.service';

@ApiTags('Fichas')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('fichas')
export class FichasController {
  constructor(private readonly fichasService: FichasService) {}

  @Post()
  create(@Body() createFichaDto: any) {
    return this.fichasService.create(createFichaDto);
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
    return this.fichasService.importFromExcel(+id, file.buffer, file.originalname);
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
}