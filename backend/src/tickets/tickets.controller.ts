import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { TicketsService } from './tickets.service';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  create(@Body() createTicketDto: any) {
    return this.ticketsService.create(createTicketDto);
  }

  @Get()
  findAll(
    @Query('proyecto_id') proyecto_id?: string,
    @Query('sprint_id') sprint_id?: string,
    @Query('backlog') backlog?: string
  ) {
    return this.ticketsService.findAll(
      proyecto_id ? +proyecto_id : undefined,
      sprint_id ? +sprint_id : undefined,
      backlog === 'true'
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ticketsService.findOne(+id);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() statusDto: any) {
    return this.ticketsService.updateStatus(+id, statusDto);
  }

  @Patch(':id/move')
  moveTask(@Param('id') id: string, @Body('sprint_id') sprint_id: number | null) {
    return this.ticketsService.moveTask(+id, sprint_id);
  }

  @Patch(':id/flag')
  setFlag(@Param('id') id: string, @Body() flagDto: { isBlocked: boolean, reason?: string }) {
    return this.ticketsService.setFlag(+id, flagDto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTicketDto: any) {
    return this.ticketsService.update(+id, updateTicketDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ticketsService.remove(+id);
  }
}
