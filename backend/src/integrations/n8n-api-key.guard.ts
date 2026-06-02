/**
 * N8nApiKeyGuard — Protege los endpoints que consume n8n.
 *
 * n8n NO es un usuario con JWT, así que en vez del AuthGuard normal usamos una
 * API key compartida. n8n debe enviar la cabecera:
 *
 *     x-n8n-key: <valor de N8N_API_KEY>
 *
 * Si N8N_API_KEY no está configurada en el entorno, el endpoint responde 503.
 */
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class N8nApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const provided = req.headers['x-n8n-key'];
    const expected = process.env.N8N_API_KEY;

    if (!expected) {
      throw new ServiceUnavailableException(
        'Integración n8n no configurada (falta N8N_API_KEY en el backend).',
      );
    }
    if (!provided || provided !== expected) {
      throw new UnauthorizedException('API key de n8n inválida.');
    }
    return true;
  }
}
