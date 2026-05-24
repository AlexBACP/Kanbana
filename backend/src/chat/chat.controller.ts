import {
  Controller, Post, Body, Req,
  UseGuards, ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { ChatService }    from './chat.service';
import { ChatMessageDto } from './dto/chat-message.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * POST /chat
   * Body:   { messages: ChatTurn[], provider?: 'gemini' | 'ollama' }
   * Return: { reply: string }
   *
   * 503 → Gemini sin API key configurada, u Ollama sin correr.
   */
  @Post()
  async chat(
    @Body(new ValidationPipe({ transform: true, whitelist: true })) dto: ChatMessageDto,
    @Req() req: Request,
  ): Promise<{ reply: string }> {
    const reply = await this.chatService.chat(
      dto.messages,
      (req as any).user,
      dto.provider ?? 'gemini',
    );
    return { reply };
  }
}
