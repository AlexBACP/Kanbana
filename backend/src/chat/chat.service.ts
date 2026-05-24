/**
 * ChatService — Dual-provider: Gemini 2.5 Flash y Ollama (local).
 *
 * Ambos proveedores siguen el mismo flujo:
 *   1. buildContext()     → consulta la BD e inyecta datos reales al prompt.
 *   2. buildSystemPrompt() → arma la personalidad + contexto.
 *   3. callGemini() / callOllama() → llamada HTTP nativa (sin SDK).
 *   4. Devuelve { reply: string } al controller.
 *
 * Gemini  → requiere GEMINI_API_KEY en .env  (503 si falta).
 * Ollama  → requiere Ollama corriendo en localhost:11434 (503 si no responde).
 */
import * as https from 'https';
import * as http  from 'http';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ProjectsService } from '../projects/projects.service';
import { TicketsService }  from '../tickets/tickets.service';
import { User } from '../users/entities/user.entity';

// ── Configuración ─────────────────────────────────────────────────────────────
const TEMPERATURE  = 0.65;
const MAX_TOKENS   = 1200;
const MAX_HISTORY  = 20;    // turnos enviados al modelo

const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.2';
const OLLAMA_URL   = process.env.OLLAMA_URL   ?? 'http://localhost:11434';

// ── Conocimiento base ─────────────────────────────────────────────────────────
const SENA_KNOWLEDGE = `
CONOCIMIENTO DEL SISTEMA KANBANA Y SENA:
• Kanbana es un sistema de gestión de proyectos formativos del SENA (Servicio Nacional de Aprendizaje de Colombia).
• Los proyectos se organizan en TRIMESTRES (~3 meses). Cada trimestre contiene MÓDULOS (sprints de duración fija).
• ROLES del sistema:
  - Coordinador: administra fichas, usuarios y toda la plataforma.
  - Instructor: gestiona sus fichas y proyectos, activa/cierra módulos.
  - Líder Técnico: aprendiz-líder del equipo; crea tareas, gestiona el tablero, envía el módulo a revisión.
  - Aprendiz: toma tareas del pool, trabaja en ellas, las marca como listas para revisión.
• FICHAS de formación: agrupan aprendices de un mismo programa (ej: Ficha 2847301 — ADS).
• COLA DE TRABAJO (backlog): tareas pendientes de asignación a módulo.
• ESTADOS de tarea (en orden): to_do → in_progress → testing → done.
• PRIORIDADES: alta (rojo), media (ámbar), baja (zinc).
• FLUJO APRENDIZ: toma tarea (claim) → trabaja → marca lista → el líder aprueba o rechaza.
• FLUJO LÍDER: crea tareas → asigna → revisa → al terminar envía módulo al instructor.
• FLUJO INSTRUCTOR: activa módulos → revisa el módulo enviado → aprueba o rechaza.
`.trim();

@Injectable()
export class ChatService {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly ticketsService:  TicketsService,
  ) {}

  // ── Helpers de fecha ─────────────────────────────────────────────────────
  private fmtDate(d: string | Date): string {
    return new Date(d).toLocaleDateString('es-CO', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  private daysLeft(fechaFin: string | Date): number {
    const end = new Date(fechaFin);
    end.setHours(23, 59, 59, 999);
    return Math.ceil((end.getTime() - Date.now()) / 86_400_000);
  }

  private daysStr(d: number): string {
    if (d > 0)  return `${d} día${d === 1 ? '' : 's'} restantes`;
    if (d === 0) return 'vence hoy';
    return `vencido hace ${Math.abs(d)} día${Math.abs(d) === 1 ? '' : 's'}`;
  }

  // ── 1. Contexto completo (Gemini) ─────────────────────────────────────────
  private async buildContext(user: User): Promise<string> {
    const rolLabel = (user as any).es_lider_tecnico
      ? 'Aprendiz — Líder Técnico'
      : user.rol;

    const L: string[] = [
      '══════════════════════════════════════',
      'CONTEXTO REAL DEL SISTEMA KANBANA',
      '══════════════════════════════════════',
      `Usuario : ${user.nombre}`,
      `Rol     : ${rolLabel}`,
      `Email   : ${(user as any).email ?? 'N/A'}`,
    ];

    try {
      const projects = await this.projectsService.findForUser(user);

      if (!projects?.length) {
        L.push('\nSin proyectos asignados.');
        return L.join('\n');
      }

      // ── Revisiones pendientes (instructor/coordinador) ────────────────────
      if (user.rol === 'instructor') {
        try {
          const pendientes = await this.projectsService.getSprintsPendientesRevision(user.id);
          if (pendientes.length) {
            L.push(`\n⚠️  MÓDULOS PENDIENTES DE REVISIÓN (${pendientes.length}):`);
            for (const s of pendientes) {
              const proy = (s as any).proyecto?.nombre ?? '?';
              const lider = (s as any).proyecto?.lider?.nombre ?? '?';
              L.push(`   • "${s.nombre}" — proyecto "${proy}" — enviado por ${lider}`);
            }
          }
        } catch { /* opcional */ }
      }

      L.push(`\n──────────────────────────────────────`);
      L.push(`PROYECTOS (${projects.length} total):`);
      L.push(`──────────────────────────────────────`);

      const shown = projects.slice(0, 6); // máx 6 para no saturar el prompt

      for (const project of shown) {
        // Datos base del proyecto (ya cargados por findForUser con relaciones)
        const ficha  = (project as any).ficha;
        const lider  = (project as any).lider;
        const miembros: any[] = (project as any).miembros ?? [];

        const fichaStr   = ficha   ? `Ficha ${ficha.numero} — ${ficha.nombre ?? ''}`.trim() : 'Sin ficha';
        const liderStr   = lider   ? lider.nombre : 'Sin líder asignado';
        const equipoStr  = miembros.length
          ? miembros.map((m: any) => m.nombre).join(', ')
          : 'Sin miembros';

        L.push(`\n► Proyecto : "${project.nombre}" (ID: ${project.id})`);
        L.push(`  Ficha    : ${fichaStr}`);
        L.push(`  Líder    : ${liderStr}`);
        L.push(`  Equipo   : ${equipoStr} (${miembros.length} miembro${miembros.length !== 1 ? 's' : ''})`);

        try {
          // ── Módulo activo ───────────────────────────────────────────────
          const sprint = await this.projectsService.findActiveSprint(project.id);

          if (!sprint) {
            L.push('  Módulo activo : ninguno');
          } else {
            const dl    = this.daysLeft(sprint.fecha_fin);
            const estado = sprint.pendiente_revision
              ? '⏳ enviado a revisión del instructor'
              : (sprint as any).esta_finalizado ? '✅ finalizado' : '🟢 activo';

            L.push(`  Módulo activo : "${sprint.nombre}" (ID: ${sprint.id})`);
            L.push(`  Período       : ${this.fmtDate(sprint.fecha_inicio)} → ${this.fmtDate(sprint.fecha_fin)} | ${this.daysStr(dl)}`);
            L.push(`  Estado módulo : ${estado}`);

            if (sprint.descripcion) {
              L.push(`  Descripción   : ${sprint.descripcion}`);
            }

            // ── Tareas del módulo ─────────────────────────────────────────
            const tickets = await this.ticketsService.findAll(project.id, sprint.id);

            if (!tickets.length) {
              L.push('  Tareas        : sin tareas en este módulo');
            } else {
              const done     = tickets.filter(t => t.estado === 'done').length;
              const inProg   = tickets.filter(t => t.estado === 'in_progress').length;
              const testing  = tickets.filter(t => t.estado === 'testing').length;
              const todo     = tickets.filter(t => t.estado === 'to_do').length;
              const pct      = Math.round((done / tickets.length) * 100);

              L.push(`  Progreso      : ${pct}% completado`);
              L.push(`  Por estado    : ✅ done ${done} | 🔄 en progreso ${inProg} | 🧪 testing ${testing} | 📋 pendiente ${todo}`);
              L.push(`  Tareas del módulo (${tickets.length}):`);

              for (const t of tickets.slice(0, 12)) {
                const asig     = t.asignado_a?.nombre ?? 'Sin asignar';
                const completo = (t as any).completado_por_aprendiz ? ' [lista p/revisión]' : '';
                L.push(`    • [#${t.id}] "${t.titulo}" [${t.estado}] [${t.prioridad}] → ${asig}${completo}`);
              }
              if (tickets.length > 12) L.push(`    … y ${tickets.length - 12} tareas más`);
            }
          }

          // ── Backlog (tareas sin módulo) ───────────────────────────────
          const backlog = await this.ticketsService.findAll(project.id, undefined, true);
          if (backlog.length) {
            L.push(`  Cola de trabajo (backlog): ${backlog.length} tarea${backlog.length !== 1 ? 's' : ''} sin módulo`);
            for (const t of backlog.slice(0, 5)) {
              L.push(`    • "${t.titulo}" [${t.prioridad}]`);
            }
            if (backlog.length > 5) L.push(`    … y ${backlog.length - 5} más`);
          }

          // ── Historial de módulos ──────────────────────────────────────
          const sprints   = await this.projectsService.findAllSprints(project.id);
          const completed = sprints.filter((s: any) => s.esta_finalizado);
          const pending   = sprints.filter((s: any) => !s.esta_activo && !s.esta_finalizado);

          if (completed.length) L.push(`  Módulos completados : ${completed.length}`);
          if (pending.length)   L.push(`  Módulos en backlog  : ${pending.length} (planificados sin activar)`);

        } catch { L.push('  (error al cargar detalles del proyecto)'); }
      }

      if (projects.length > 6) {
        L.push(`\n… y ${projects.length - 6} proyectos más no mostrados por espacio.`);
      }

    } catch { L.push('\n(Error al cargar contexto de proyectos)'); }

    L.push('\n══════════════════════════════════════');
    return L.join('\n');
  }

  // ── 1b. Contexto resumido (Ollama — tokens limitados) ─────────────────────
  private async buildBriefContext(user: User): Promise<string> {
    const rolLabel = (user as any).es_lider_tecnico ? 'Líder Técnico' : user.rol;
    const L: string[] = [`Usuario: ${user.nombre} | Rol: ${rolLabel}`];

    try {
      const projects = await this.projectsService.findForUser(user);

      if (!projects?.length) { L.push('Sin proyectos.'); return L.join('\n'); }

      L.push(`Proyectos (${projects.length}):`);

      for (const project of projects.slice(0, 3)) {
        L.push(`\n• "${project.nombre}" (ID: ${project.id})`);

        try {
          const sprint = await this.projectsService.findActiveSprint(project.id);
          if (!sprint) {
            L.push('  Sin módulo activo.');
          } else {
            const dl = this.daysLeft(sprint.fecha_fin);
            const tickets = await this.ticketsService.findAll(project.id, sprint.id);
            const done = tickets.filter(t => t.estado === 'done').length;
            L.push(`  Módulo: "${sprint.nombre}" | ${this.daysStr(dl)}`);
            L.push(`  Tareas: ${tickets.length} total, ${done} completadas`);

            for (const t of tickets.slice(0, 5)) {
              const asig = t.asignado_a?.nombre ?? '—';
              L.push(`    – [#${t.id}] "${t.titulo}" [${t.estado}] → ${asig}`);
            }
          }
        } catch { L.push('  (datos no disponibles)'); }
      }

      if (projects.length > 3) L.push(`… y ${projects.length - 3} proyectos más.`);

    } catch { L.push('(error al cargar proyectos)'); }

    return L.join('\n');
  }

  // ── 2. System prompts ─────────────────────────────────────────────────────

  /** Prompt completo para Gemini (rápido, no importa el tamaño). */
  private buildGeminiPrompt(contextText: string): string {
    return `Eres KanbanaAI, el asistente de Kanbana — sistema de gestión de proyectos del SENA.

${SENA_KNOWLEDGE}

${contextText}

INSTRUCCIONES:
- Responde SIEMPRE en español, de forma clara y concisa.
- Usa los datos del CONTEXTO para responder preguntas sobre el proyecto, módulo y tareas.
- No inventes datos. Si no tienes información, dilo claramente.
- Si el usuario saluda, preséntate brevemente como KanbanaAI.
- Máximo 3-4 párrafos. Usa **negritas** y listas para claridad.`;
  }

  /**
   * Prompt mínimo para Ollama.
   * llama3.2 evalúa ~9 tokens/seg en CPU; cada 100 tokens extra = +11 seg.
   * Se omite SENA_KNOWLEDGE para que la respuesta llegue en < 30 seg.
   */
  private buildOllamaPrompt(contextText: string): string {
    return `Eres KanbanaAI, asistente del sistema Kanbana del SENA. Responde en español de forma concisa. No inventes datos.

${contextText}

Si el usuario saluda, preséntate como KanbanaAI. Máximo 2-3 párrafos.`;
  }

  // ── 3a. Llamada a Gemini (https nativo) ──────────────────────────────────
  private callGemini(
    systemPrompt: string,
    messages:     { role: string; content: string }[],
  ): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new ServiceUnavailableException('GEMINI_API_KEY no configurada');

    const contents = this.normalizeForGemini(messages);
    const payload  = JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { temperature: TEMPERATURE, maxOutputTokens: MAX_TOKENS },
    });

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: 'generativelanguage.googleapis.com',
          path:     `/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          method:   'POST',
          headers:  {
            'Content-Type':   'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        (res) => {
          let raw = '';
          res.on('data', (c) => { raw += c; });
          res.on('end', () => {
            try {
              const json  = JSON.parse(raw);
              const reply = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
              if (!reply && json?.error) reject(new Error(json.error.message));
              else resolve(reply || 'No pude generar una respuesta.');
            } catch { reject(new Error('Respuesta inválida de Gemini')); }
          });
        },
      );
      req.on('error', reject);
      req.setTimeout(30_000, () => { req.destroy(); reject(new Error('Timeout Gemini')); });
      req.write(payload);
      req.end();
    });
  }

  /** Gemini requiere roles alternados user/model y que el primero sea 'user'. */
  private normalizeForGemini(messages: { role: string; content: string }[]) {
    const mapped = messages
      .filter((m) => m.content?.trim())
      .map((m) => ({
        role:  m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content.trim() }],
      }));

    // Fusionar consecutivos del mismo rol
    const merged: { role: string; parts: { text: string }[] }[] = [];
    for (const m of mapped) {
      const last = merged[merged.length - 1];
      if (last && last.role === m.role) last.parts[0].text += '\n' + m.parts[0].text;
      else merged.push({ role: m.role, parts: [{ text: m.parts[0].text }] });
    }

    // El primero debe ser 'user'
    while (merged.length > 0 && merged[0].role !== 'user') merged.shift();
    return merged;
  }

  // ── 3b. Llamada a Ollama (http nativo, stream: false) ────────────────────
  private callOllama(
    systemPrompt: string,
    messages:     { role: string; content: string }[],
  ): Promise<string> {
    const parsed  = new URL(OLLAMA_URL);
    const isHttps = parsed.protocol === 'https:';
    const host    = parsed.hostname;
    const port    = parseInt(parsed.port || (isHttps ? '443' : '11434'), 10);

    const allMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const payload = JSON.stringify({
      model:    OLLAMA_MODEL,
      messages: allMessages,
      stream:   false,
      options:  { temperature: TEMPERATURE, num_ctx: 4096 },
    });

    const lib = isHttps ? https : http;

    return new Promise((resolve, reject) => {
      const req = lib.request(
        {
          hostname: host,
          port,
          path:     '/api/chat',
          method:   'POST',
          headers:  {
            'Content-Type':   'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        (res) => {
          let raw = '';
          res.on('data', (c) => { raw += c; });
          res.on('end', () => {
            try {
              const json  = JSON.parse(raw);
              const reply = json?.message?.content ?? '';
              resolve(reply || 'Ollama no generó respuesta.');
            } catch { reject(new Error('Respuesta inválida de Ollama')); }
          });
        },
      );

      req.on('error', (err: any) => {
        if (err.code === 'ECONNREFUSED') {
          reject(new ServiceUnavailableException(
            `Ollama no está corriendo en ${OLLAMA_URL}. Ejecuta: ollama serve`,
          ));
        } else {
          reject(err);
        }
      });

      req.setTimeout(120_000, () => {
        req.destroy();
        reject(new Error(`Timeout: ${OLLAMA_MODEL} tardó demasiado. Prueba con una pregunta más corta.`));
      });

      req.write(payload);
      req.end();
    });
  }

  // ── Punto de entrada ──────────────────────────────────────────────────────
  async chat(
    messages: { role: string; content: string }[],
    user:     User,
    provider: 'gemini' | 'ollama' = 'gemini',
  ): Promise<string> {
    const history = messages.slice(-MAX_HISTORY);

    if (provider === 'ollama') {
      // Contexto breve → menos tokens → respuesta en ~20-40s en vez de ~90s
      const contextText  = await this.buildBriefContext(user);
      const systemPrompt = this.buildOllamaPrompt(contextText);
      return this.callOllama(systemPrompt, history);
    }

    // Gemini: contexto completo (veloz, sin límite de tokens relevante)
    const contextText  = await this.buildContext(user);
    const systemPrompt = this.buildGeminiPrompt(contextText);
    return this.callGemini(systemPrompt, history);
  }
}
