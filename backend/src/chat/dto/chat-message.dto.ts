import { IsArray, IsString, ValidateNested, IsIn, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class ChatTurnDto {
  @IsString()
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  content: string;
}

export class ChatMessageDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatTurnDto)
  messages: ChatTurnDto[];

  /** Proveedor de IA: 'gemini' (default) o 'ollama' (local). */
  @IsOptional()
  @IsString()
  @IsIn(['gemini', 'ollama'])
  provider?: 'gemini' | 'ollama';
}
