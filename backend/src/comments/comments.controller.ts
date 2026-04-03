import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';
import { CommentsService } from './comments.service';

@Controller('tickets/:ticketId/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  create(@Param('ticketId') ticketId: string, @Body() createCommentDto: any) {
    return this.commentsService.create(+ticketId, createCommentDto);
  }

  @Get()
  findByTicket(@Param('ticketId') ticketId: string) {
    return this.commentsService.findByTicket(+ticketId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.commentsService.remove(+id);
  }
}
