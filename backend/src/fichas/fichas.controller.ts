import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  UseGuards, Request, UseInterceptors, UploadedFile,
  BadRequestException,
} from '@nestjs/common';
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
    ];
    if (!allowed.includes(file.mimetype) && !file.originalname.match(/\.(xlsx|xls)$/i)) {
      throw new BadRequestException('Solo se aceptan archivos .xlsx o .xls');
    }
    return this.fichasService.importFromExcel(+id, file.buffer);
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
}
