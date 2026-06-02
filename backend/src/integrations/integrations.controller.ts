/**
 * IntegrationsController — Endpoints para la integración con n8n.
 *
 * Rutas (prefijo global /api):
 *   GET  /api/integrations/n8n/resumen-diario   → datos para el digest (cron de n8n)
 *   POST /api/integrations/n8n/test             → dispara un evento de prueba a n8n
 *   GET  /api/integrations/n8n/status           → estado de la integración
 *
 * Todos protegidos por API key (cabecera x-n8n-key).
 */
import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { N8nService } from './n8n.service';
import { N8nApiKeyGuard } from './n8n-api-key.guard';

@Controller('integrations/n8n')
@UseGuards(N8nApiKeyGuard)
export class IntegrationsController {
  constructor(private readonly n8n: N8nService) {}

  /** n8n llama esto por cron (cada mañana) para armar el resumen del instructor. */
  @Get('resumen-diario')
  resumenDiario() {
    return this.n8n.buildResumenDiario();
  }

  /** Estado de la integración (útil para depurar). */
  @Get('status')
  status() {
    return {
      salida_configurada: this.n8n.enabled,
      mensaje: this.n8n.enabled
        ? 'N8N_WEBHOOK_URL configurada — los eventos salientes están activos.'
        : 'N8N_WEBHOOK_URL no configurada — los eventos salientes están apagados.',
    };
  }

  /** Dispara un evento de prueba hacia n8n para validar el webhook. */
  @Post('test')
  async test() {
    await this.n8n.emit('test', { mensaje: 'Hola desde Kanbana 👋' });
    return { ok: true, salida_configurada: this.n8n.enabled };
  }
}
