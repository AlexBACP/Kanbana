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
╔══════════════════════════════════════════════════════════════════════════╗
║ CONOCIMIENTO COMPLETO DEL SISTEMA KANBANA                                ║
╚══════════════════════════════════════════════════════════════════════════╝

▌ QUÉ ES KANBANA
Plataforma de gestión de proyectos formativos del SENA (Servicio Nacional
de Aprendizaje, Colombia) orientada al programa ADSO (Análisis y Desarrollo
de Software). Combina metodología Kanban + Scrum simplificado.

▌ ESTRUCTURA JERÁRQUICA
Ficha (grupo de formación, ej: "2847301")
  └─ Proyecto (un proyecto formativo de la ficha)
      └─ Trimestre (etapa lectiva ~3 meses, hasta 6 en tecnólogo)
          └─ Módulo (sprint de duración fija, ~2-4 semanas)
              └─ Tarea (ticket: TASK / BUG / STORY)

▌ ROLES
• COORDINADOR (azul): acceso total. Crea fichas, asigna instructores,
  gestiona TODOS los usuarios, cambia contraseñas, mueve aprendices entre fichas.
• INSTRUCTOR (cyan): gestiona SUS fichas. Crea proyectos, activa/cierra
  módulos, aprueba módulos enviados por el líder, cambia contraseñas de SUS
  aprendices, aprueba solicitudes de vinculación.
• APRENDIZ (ámbar): trabaja en SU proyecto. Toma tareas del pool, sube
  evidencia/adjuntos, marca tareas como listas para revisión.
• LÍDER TÉCNICO (esmeralda): sub-rol del aprendiz. Crea/asigna tareas a su
  equipo, solicita módulos al instructor, envía módulos a revisión.

▌ FLUJO DE ESTADOS DE UNA TAREA
to_do → in_progress → testing → done
• to_do: por hacer (en cola del módulo o cola general)
• in_progress: alguien está trabajando en ella
• testing: el aprendiz la marcó lista; espera revisión del líder
• done: aprobada por el líder, contabiliza como entregada
Si el líder rechaza en testing → vuelve a in_progress + queda bloqueada
con motivo de corrección visible en la tarjeta.

▌ TIPOS DE TAREA
• TASK (azul, ícono Layers): tarea normal del flujo
• BUG (rojo, ícono Bug): defecto/error a corregir
• STORY (púrpura, ícono BookOpen): historia de usuario, alcance mayor

▌ PRIORIDADES Y STORY POINTS
• alta (punto rojo) / media (punto ámbar) / baja (sin punto)
• Story points: estimación de esfuerzo (0, 1, 2, 3, 5, 8, 13)

▌ MÓDULOS (SPRINTS)
• Estados: planificado → activo → finalizado
• Hasta 3 módulos activos simultáneamente por trimestre
• Numeración de tareas: cada módulo tiene su propio #1, #2, #3...
• Cierre: requiere TODAS las tareas en "done" + adjuntos obligatorios subidos
• Trimestre DOCUMENTAL: módulos requieren adjunto por tarea
• Trimestre HISTÓRICO: solo referencia, no permite operación

▌ CÓMO HACER COSAS COMUNES

CAMBIAR MI CONTRASEÑA → Perfil (avatar arriba-derecha) → Cambiar contraseña.
Requiere contraseña actual. Política: ≥7 chars, ≥1 mayúscula, ≥1 número.
Máximo 2 cambios por día.

CAMBIAR CONTRASEÑA DE OTRO USUARIO (admin) → Usuarios → click en el usuario
→ Cambiar contraseña. Coordinador puede a cualquiera; instructor solo a
aprendices de sus fichas.

REGISTRARME COMO APRENDIZ → Landing → "Soy aprendiz" → completar formulario
con código de ficha + jornada + documento. Confirmar correo → esperar
aprobación del instructor.

REGISTRARME COMO INSTRUCTOR → Landing → "Soy instructor" → correo
@sena.edu.co obligatorio. Confirmar correo. Sin esperar aprobación.

SUBIR ADJUNTO A TAREA → Detalle de tarea → tab "Adjuntos" → arrastrar/elegir.
Hasta 10MB por archivo. Si la tarea es de trimestre documental, adjunto
es OBLIGATORIO para marcar done.

MOVER TAREA ENTRE COLUMNAS → Tablero Kanban → arrastrar la tarjeta.
También se puede cambiar el estado desde el detalle de la tarea (select arriba).

VINCULAR REPO DE GITHUB → Conectar mi cuenta GitHub en Perfil → en el
proyecto → "Recursos" → "Vincular repositorio". Auto-instala webhook.
Commits con "KAN-X" mueven la tarea X automáticamente entre estados.

MOVER APRENDIZ A OTRA FICHA → (solo coordinador) Usuarios → click "Mover"
en el aprendiz → seleccionar la ficha de destino.

PQRS (Peticiones/Quejas/Reclamos/Sugerencias) → Landing → sección PQRS al
final → seleccionar tipo + mensaje. Llega por correo al admin.

▌ NOTIFICACIONES EN TIEMPO REAL
Toast emergente cuando: tarea asignada, comentario nuevo, módulo activado,
tarea para revisar, permiso aprobado/rechazado, vinculación aprobada.
Las notificaciones tienen link directo al recurso correspondiente.

▌ TÉRMINOS QUE PUEDES OÍR
• Sprint = Módulo (sinónimos)
• Backlog = Cola de trabajo (tareas sin módulo asignado)
• Tablero = Kanban del proyecto
• Ficha SENA = grupo de aprendices del programa
• Tecnólogo = 6 trimestres / Técnico = 3 trimestres
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
    return `Eres KanbanaAI, el asistente OFICIAL de Kanbana — plataforma de gestión de proyectos del SENA (ADSO).
Te creó Brandon Palma como parte del proyecto formativo. Estás integrado dentro de la app.

${SENA_KNOWLEDGE}

${contextText}

INSTRUCCIONES IMPORTANTES:
- Eres EXPERTO en Kanbana. Conoces todos sus flujos, roles, pantallas y atajos.
- NUNCA digas "no tengo esa información" o "consulta la documentación" si la respuesta
  está en el CONOCIMIENTO DEL SISTEMA arriba. Eres parte del sistema, no externo a él.
- Responde SIEMPRE en español, claro y al grano.
- Para preguntas tipo "¿cómo hago X?" → da pasos numerados concretos con los nombres
  reales de los botones/pestañas/secciones (ej: "Perfil → Cambiar contraseña").
- Usa los datos del CONTEXTO del usuario actual (proyecto, módulo, tareas) cuando aplique.
- Si el usuario saluda, preséntate breve como KanbanaAI.
- Formato: **negritas** para nombres de secciones y botones, listas para pasos.
- Largo ideal: 2-4 párrafos máximo. Sé directo.`;
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

  // ── 3b. Llamada a Groq (compatible OpenAI, modelo llama rápido) ─────────
  private callGroq(
    systemPrompt: string,
    messages:     { role: string; content: string }[],
  ): Promise<string> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new ServiceUnavailableException('GROQ_API_KEY no configurada');

    const allMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({ role: m.role, content: m.content })),
    ];
    const payload = JSON.stringify({
      model:       'llama-3.3-70b-versatile',
      messages:    allMessages,
      temperature: TEMPERATURE,
      max_tokens:  MAX_TOKENS,
    });

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: 'api.groq.com',
          path:     '/openai/v1/chat/completions',
          method:   'POST',
          headers:  {
            'Content-Type':   'application/json',
            'Content-Length': Buffer.byteLength(payload),
            'Authorization':  `Bearer ${apiKey}`,
          },
        },
        (res) => {
          let raw = '';
          res.on('data', (c) => { raw += c; });
          res.on('end', () => {
            try {
              const json  = JSON.parse(raw);
              const reply = json?.choices?.[0]?.message?.content ?? '';
              if (!reply && json?.error) reject(new Error(json.error.message));
              else resolve(reply || 'No pude generar una respuesta.');
            } catch { reject(new Error('Respuesta inválida de Groq')); }
          });
        },
      );
      req.on('error', reject);
      req.setTimeout(30_000, () => { req.destroy(); reject(new Error('Timeout Groq')); });
      req.write(payload);
      req.end();
    });
  }

  // ── 3c. Llamada a Ollama (http nativo, stream: false) ────────────────────
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

  // ── Punto de entrada con cadena de fallback ──────────────────────────────
  // Orden: Gemini → Groq → Ollama
  // Solo usa Ollama si se solicita explícitamente o si los otros dos fallan.
  async chat(
    messages: { role: string; content: string }[],
    user:     User,
    provider: 'gemini' | 'ollama' | 'groq' = 'gemini',
  ): Promise<string> {
    const history = messages.slice(-MAX_HISTORY);

    // ── Ollama explícito (solo dev local) ────────────────────────────────────
    if (provider === 'ollama') {
      const contextText  = await this.buildBriefContext(user);
      const systemPrompt = this.buildOllamaPrompt(contextText);
      return this.callOllama(systemPrompt, history);
    }

    // ── Contexto completo para modelos cloud ────────────────────────────────
    const contextText  = await this.buildContext(user);
    const systemPrompt = this.buildGeminiPrompt(contextText);  // misma calidad para Groq

    // ── Groq explícito ────────────────────────────────────────────────────
    if (provider === 'groq') {
      return this.callGroq(systemPrompt, history);
    }

    // ── Gemini con fallback automático a Groq ────────────────────────────
    // Si Gemini no está configurado o falla → intenta Groq → intenta Ollama
    const hasGemini = !!process.env.GEMINI_API_KEY;
    const hasGroq   = !!process.env.GROQ_API_KEY;

    if (hasGemini) {
      try {
        return await this.callGemini(systemPrompt, history);
      } catch (err: any) {
        console.warn('[ChatService] Gemini falló, intentando Groq...', err?.message);
      }
    }

    if (hasGroq) {
      try {
        return await this.callGroq(systemPrompt, history);
      } catch (err: any) {
        console.warn('[ChatService] Groq falló, intentando Ollama...', err?.message);
      }
    }

    // Último recurso: Ollama local
    try {
      const brief  = await this.buildBriefContext(user);
      const ollPmt = this.buildOllamaPrompt(brief);
      return await this.callOllama(ollPmt, history);
    } catch {
      throw new ServiceUnavailableException(
        'Ningún proveedor de IA está disponible. ' +
        'Configura GEMINI_API_KEY o GROQ_API_KEY en backend/.env',
      );
    }
  }
}
