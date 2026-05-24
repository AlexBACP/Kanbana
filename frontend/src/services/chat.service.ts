/**
 * chatService — POST /chat  →  { reply: string }
 *
 * Usa la misma instancia axios de services/api.ts para que el interceptor
 * de auth (Bearer token + auto-refresh) funcione igual que el resto de la app.
 */
import api from './api';

export interface ChatTurn {
  role:    'user' | 'assistant';
  content: string;
}

export const chatService = {
  async sendMessage(
    messages: ChatTurn[],
    provider: 'gemini' | 'ollama' = 'gemini',
  ): Promise<string> {
    const res = await api.post<{ reply: string }>('/chat', { messages, provider });
    return res.data.reply ?? 'Sin respuesta del servidor.';
  },
};
