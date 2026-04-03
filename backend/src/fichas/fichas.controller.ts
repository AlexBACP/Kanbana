import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { FichasService } from './fichas.service';

@Controller('fichas')
export class FichasController {
  constructor(private readonly fichasService: FichasService) {}

  @Post()
  create(@Body() createFichaDto: any) {
    return this.fichasService.create(createFichaDto);
  }

  @Get()
  findAll() {
    return this.fichasService.findAll();
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
}
