/**
 * N8nService — Integración con n8n (automatización de flujos).
 *
 * Soporta las DOS direcciones de la integración:
 *
 *   1) SALIENTE (Kanbana → n8n):  emit(evento, datos)
 *      Hace un POST fire-and-forget a la URL del webhook de n8n
 *      (env N8N_WEBHOOK_URL). Si la variable no está definida, no hace nada
 *      (la integración queda "apagada" sin romper la app).
 *
 *   2) ENTRANTE (n8n → Kanbana):  buildResumenDiario()
 *      Devuelve el resumen de tareas pendientes/vencidas agrupado por
 *      instructor. Lo consume el endpoint GET /api/integrations/n8n/resumen-diario
 *      (protegido por API key) que n8n llama por cron cada mañana.
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { Ticket, TicketStatus } from '../tickets/entities/ticket.entity';

export interface TicketResumen {
  id: number;
  titulo: string;
  estado: string;
  prioridad: string;
  proyecto: string;
  asignado_a: string | null;
  fecha_limite: string | null;
}

export interface ResumenInstructor {
  instructor: { id: number; nombre: string; correo: string };
  ficha: string | null;
  total_pendientes: number;
  vencidas: TicketResumen[];
  proximas_24h: TicketResumen[];
}

@Injectable()
export class N8nService {
  private readonly logger = new Logger(N8nService.name);

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketsRepo: Repository<Ticket>,
  ) {}

  private get webhookUrl(): string {
    return process.env.N8N_WEBHOOK_URL || '';
  }

  /** ¿Está configurada la salida hacia n8n? */
  get enabled(): boolean {
    return !!this.webhookUrl;
  }

  // ── SALIENTE: dispara un evento hacia n8n ───────────────────────────────────
  /**
   * Envía un evento a n8n (POST). Fire-and-forget: nunca lanza, solo loguea,
   * para que un fallo de n8n jamás tumbe una operación de Kanbana.
   */
  async emit(evento: string, datos: Record<string, any>): Promise<void> {
    const url = this.webhookUrl;
    if (!url) return; // integración desactivada

    const payload = {
      evento,
      datos,
      origen: 'kanbana',
      emitido_en: new Date().toISOString(),
    };

    try {
      // Node 18+ trae fetch global (igual que el resto del proyecto con Gemini)
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      this.logger.debug(`→ n8n evento '${evento}' emitido`);
    } catch (err: any) {
      this.logger.warn(`No se pudo emitir '${evento}' a n8n: ${err?.message ?? err}`);
    }
  }

  // ── ENTRANTE: construye el resumen diario por instructor ────────────────────
  async buildResumenDiario() {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const en24h = new Date(hoy.getTime() + 24 * 60 * 60 * 1000);

    let tickets: Ticket[] = [];
    try {
      tickets = await this.ticketsRepo.find({
        where: { estado: Not(TicketStatus.DONE) as any },
        relations: ['asignado_a', 'proyecto', 'proyecto.instructor', 'proyecto.ficha'],
      });
    } catch (err: any) {
      this.logger.error(`Error al construir resumen diario: ${err?.message ?? err}`);
      return { generado_en: new Date().toISOString(), total_instructores: 0, resumenes: [] };
    }

    const grupos = new Map<number, ResumenInstructor>();

    for (const t of tickets) {
      const proyecto: any = (t as any).proyecto;
      const instructor = proyecto?.instructor;
      if (!instructor) continue; // proyecto sin instructor → se ignora

      if (!grupos.has(instructor.id)) {
        grupos.set(instructor.id, {
          instructor: {
            id: instructor.id,
            nombre: instructor.nombre,
            correo: instructor.correo,
          },
          ficha: proyecto?.ficha?.codigo ?? null,
          total_pendientes: 0,
          vencidas: [],
          proximas_24h: [],
        });
      }

      const g = grupos.get(instructor.id)!;
      g.total_pendientes++;

      const resumen: TicketResumen = {
        id: t.id,
        titulo: t.titulo,
        estado: t.estado,
        prioridad: t.prioridad,
        proyecto: proyecto?.nombre ?? '',
        asignado_a: (t as any).asignado_a?.nombre ?? null,
        fecha_limite: t.fecha_limite ? new Date(t.fecha_limite).toISOString().slice(0, 10) : null,
      };

      if (t.fecha_limite) {
        const fl = new Date(t.fecha_limite);
        if (fl < hoy) g.vencidas.push(resumen);
        else if (fl < en24h) g.proximas_24h.push(resumen);
      }
    }

    const resumenes = Array.from(grupos.values());
    return {
      generado_en: new Date().toISOString(),
      total_instructores: resumenes.length,
      resumenes,
    };
  }
}
