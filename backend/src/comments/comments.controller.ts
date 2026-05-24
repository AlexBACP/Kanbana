import {
  Controller, Get, Post, Body, Param,
  Delete, UseGuards, Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CommentsService } from './comments.service';

@UseGuards(AuthGuard('jwt'))
@Controller('tickets/:ticketId/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  create(
    @Param('ticketId') ticketId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    // Inyectar usuario_id desde el JWT — el frontend no lo envía, el backend lo asigna.
    return this.commentsService.create(+ticketId, {
      ...body,
      usuario_id: req.user.id,
    });
  }

  @Get()
  findByTicket(@Param('ticketId') ticketId: string) {
    return this.commentsService.findByTicket(+ticketId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.commentsService.remove(+id, req.user);
  }
}
