import * as https from 'https';
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SugerenciaModulo, SugerenciaFuente, SugerenciaEstado } from './entities/sugerencia-modulo.entity';
import { Sprint }    from './entities/sprint.entity';
import { Trimestre } from './entities/trimestre.entity';
import { Project }   from './entities/project.entity';
import { PLANTILLAS_POR_TIPO, CATALOGO_SUGERENCIAS } from '../fichas/plantillas-sdlc';

const GEMINI_TEMPERATURE = 0.7;
const GEMINI_MAX_TOKENS  = 8192;
const MAX_POR_TRIMESTRE  = 4;

/** Normaliza un texto para comparar nombres (sin acentos, minúsculas, alfanumérico). */
const DIACRITICS = /[̀-ͯ]/g;
function norm(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(DIACRITICS, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** ¿a y b son "el mismo módulo"? Igualdad normalizada o contención significativa. */
function mismoNombre(a: string, b: string): boolean {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 8 && nb.includes(na)) return true;
  if (nb.length >= 8 && na.includes(nb)) return true;
  return false;
}

@Injectable()
export class SugerenciasService {
  private readonly logger = new Logger('SugerenciasService');

  constructor(
    @InjectRepository(SugerenciaModulo) private readonly sugRepo:  Repository<SugerenciaModulo>,
    @InjectRepository(Sprint)           private readonly sprintsRepo: Repository<Sprint>,
    @InjectRepository(Trimestre)        private readonly trimestresRepo: Repository<Trimestre>,
    @InjectRepository(Project)          private readonly projectsRepo: Repository<Project>,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // LISTAR
  // ═══════════════════════════════════════════════════════════════════════════

  /** Devuelve las sugerencias activas (no descartadas) agrupadas por trimestre. */
  async listar(proyectoId: number): Promise<any> {
    const project = await this.projectsRepo.findOne({ where: { id: proyectoId } });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    if (!project.fichaId) return { ia_disponible: this.geminiDisponible(), trimestres: [] };

    const trimestres = await this.trimestresRepo.find({
      where: { ficha_id: project.fichaId },
      order: { numero: 'ASC' },
    });

    const sugerencias = await this.sugRepo.find({
      where: { proyecto_id: proyectoId },
      order: { creado_en: 'ASC' },
    });
    const activas = sugerencias.filter(s => s.estado !== SugerenciaEstado.DESCARTADA);

    return {
      ia_disponible: this.geminiDisponible(),
      total: activas.filter(s => s.estado === SugerenciaEstado.SUGERIDA).length,
      trimestres: trimestres.map(t => ({
        id: t.id,
        numero: t.numero,
        nombre: t.nombre,
        tipo: t.tipo,
        sugerencias: activas.filter(s => s.trimestre_id === t.id),
      })),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GENERAR
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Genera sugerencias para el proyecto. Si ya hay sugerencias 'sugerida' y no
   * se fuerza, solo las devuelve. Con regenerar=true borra las 'sugerida'
   * (conserva creadas/descartadas para no repetirlas) y vuelve a analizar.
   */
  async generar(proyectoId: number, regenerar = false): Promise<any> {
    const project = await this.projectsRepo.findOne({ where: { id: proyectoId } });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    if (!project.fichaId) throw new BadRequestException('El proyecto no tiene ficha asignada.');

    const ficha = await this.projectsRepo.manager
      .getRepository('Ficha')
      .findOne({ where: { id: project.fichaId } }) as any;
    if (!ficha) throw new BadRequestException('Ficha no encontrada.');

    const trimestres = await this.trimestresRepo.find({
      where: { ficha_id: project.fichaId },
      order: { numero: 'ASC' },
    });
    if (!trimestres.length) {
      throw new BadRequestException('El proyecto no tiene trimestres. Genera primero los módulos base.');
    }

    const existentes = await this.sugRepo.find({ where: { proyecto_id: proyectoId } });

    if (regenerar) {
      await this.sugRepo.delete({ proyecto_id: proyectoId, estado: SugerenciaEstado.SUGERIDA });
    } else if (existentes.some(s => s.estado === SugerenciaEstado.SUGERIDA)) {
      // Ya hay sugerencias pendientes → no gastar IA, devolver lo que hay.
      return this.listar(proyectoId);
    }

    // Nombres que NO se deben sugerir (módulos ya existentes + plantilla SDLC +
    // sugerencias previas creadas/descartadas) por trimestre.
    const tipo = ficha.tipo_formacion === 'tecnico' ? 'tecnico' : 'tecnologo';
    const plantilla = PLANTILLAS_POR_TIPO[tipo] ?? [];
    const sprints = await this.sprintsRepo.find({ where: { proyecto_id: proyectoId } });
    const sugPrevias = await this.sugRepo.find({ where: { proyecto_id: proyectoId } });

    const evitarPorTrim = new Map<number, string[]>();
    trimestres.forEach((t, i) => {
      const nombres: string[] = [];
      nombres.push(...sprints.filter(s => s.trimestre_id === t.id).map(s => s.nombre));
      (plantilla[i]?.modulos ?? []).forEach(m => nombres.push(m.nombre));
      nombres.push(...sugPrevias.filter(s => s.trimestre_id === t.id).map(s => s.nombre));
      evitarPorTrim.set(t.id, nombres);
    });

    // ── Intentar IA; si falla, caer al catálogo ──────────────────────────────
    let propuestas: { numero: number; items: any[]; fuente: SugerenciaFuente }[] = [];
    try {
      if (this.geminiDisponible()) {
        propuestas = await this.generarConIA(project, ficha, trimestres);
      } else {
        throw new Error('Gemini no configurado');
      }
    } catch (err: any) {
      this.logger.warn(`IA no disponible (${err.message}); usando catálogo SDLC.`);
      propuestas = this.generarConCatalogo(trimestres);
    }

    // ── Persistir deduplicando ────────────────────────────────────────────────
    let creadas = 0;
    for (const prop of propuestas) {
      const trim = trimestres.find(t => t.numero === prop.numero);
      if (!trim) continue;
      const evitar = evitarPorTrim.get(trim.id) ?? [];
      const yaSugeridasEnTrim: string[] = [];

      for (const item of (prop.items ?? []).slice(0, MAX_POR_TRIMESTRE)) {
        const nombre = (item.nombre || '').trim();
        if (!nombre) continue;
        const colision = [...evitar, ...yaSugeridasEnTrim].some(n => mismoNombre(n, nombre));
        if (colision) continue;

        await this.sugRepo.save(this.sugRepo.create({
          proyecto_id:  proyectoId,
          trimestre_id: trim.id,
          nombre,
          descripcion:  (item.descripcion || '').slice(0, 1000),
          justificacion:(item.justificacion || '').slice(0, 1000),
          semanas:      Math.min(Math.max(Number(item.semanas) || 4, 1), 12),
          categoria:    (item.categoria || 'General').slice(0, 60),
          fuente:       prop.fuente,
          estado:       SugerenciaEstado.SUGERIDA,
        }));
        yaSugeridasEnTrim.push(nombre);
        creadas++;
      }
    }

    this.logger.log(`Proyecto #${proyectoId}: ${creadas} sugerencia(s) generada(s).`);
    return this.listar(proyectoId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // APLICAR / DESCARTAR
  // ═══════════════════════════════════════════════════════════════════════════

  /** Convierte una sugerencia en un módulo (Sprint) editable dentro de su trimestre. */
  async crearModulo(sugId: number): Promise<Sprint> {
    const sug = await this.sugRepo.findOne({ where: { id: sugId } });
    if (!sug) throw new NotFoundException('Sugerencia no encontrada');
    if (sug.estado === SugerenciaEstado.CREADA) {
      throw new BadRequestException('Esta sugerencia ya fue convertida en módulo.');
    }

    const trim = sug.trimestre_id
      ? await this.trimestresRepo.findOne({ where: { id: sug.trimestre_id } })
      : null;

    // Calcular fechas: tras el último módulo del trimestre, dentro de su rango.
    let inicio = new Date();
    let fin    = new Date();
    if (trim) {
      const sprintsTrim = await this.sprintsRepo.find({ where: { proyecto_id: sug.proyecto_id, trimestre_id: trim.id } });
      const maxFin = sprintsTrim.reduce<Date | null>((max, s) => {
        const f = new Date(s.fecha_fin);
        return !max || f > max ? f : max;
      }, null);

      inicio = maxFin ? new Date(maxFin.getTime() + 86_400_000) : new Date(trim.fecha_inicio);
      inicio.setHours(0, 0, 0, 0);
      const trimFin = new Date(trim.fecha_fin);
      if (inicio > trimFin) inicio = new Date(trim.fecha_inicio);

      fin = new Date(inicio);
      fin.setDate(fin.getDate() + sug.semanas * 7 - 1);
      if (fin > trimFin) fin = trimFin;
    } else {
      fin.setDate(fin.getDate() + sug.semanas * 7 - 1);
    }

    const sprint = this.sprintsRepo.create({
      nombre:        sug.nombre,
      descripcion:   sug.descripcion,
      proyecto_id:   sug.proyecto_id,
      trimestre_id:  sug.trimestre_id ?? null,
      fecha_inicio:  inicio.toISOString().slice(0, 10) as any,
      fecha_fin:     fin.toISOString().slice(0, 10) as any,
      esta_activo:        false,
      esta_finalizado:    false,
      pendiente_revision: false,
    } as object);
    const saved = await this.sprintsRepo.save(sprint as unknown as Sprint) as unknown as Sprint;

    sug.estado    = SugerenciaEstado.CREADA;
    sug.sprint_id = saved.id;
    await this.sugRepo.save(sug);

    return saved;
  }

  async descartar(sugId: number): Promise<{ ok: boolean }> {
    const sug = await this.sugRepo.findOne({ where: { id: sugId } });
    if (!sug) throw new NotFoundException('Sugerencia no encontrada');
    sug.estado = SugerenciaEstado.DESCARTADA;
    await this.sugRepo.save(sug);
    return { ok: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FUENTES DE SUGERENCIAS
  // ═══════════════════════════════════════════════════════════════════════════

  private geminiDisponible(): boolean {
    return !!process.env.GEMINI_API_KEY;
  }

  /** Catálogo SDLC estático filtrado por número de trimestre (fallback determinista). */
  private generarConCatalogo(trimestres: Trimestre[]): { numero: number; items: any[]; fuente: SugerenciaFuente }[] {
    return trimestres.map(t => ({
      numero: t.numero,
      fuente: SugerenciaFuente.CATALOGO,
      items: CATALOGO_SUGERENCIAS
        .filter(s => s.trimestres_relevantes.includes(t.numero))
        .slice(0, MAX_POR_TRIMESTRE)
        .map(s => ({
          nombre:        s.nombre,
          descripcion:   s.descripcion,
          categoria:     s.categoria,
          semanas:       2,
          justificacion: `Sugerencia del catálogo SDLC para la etapa "${t.nombre}".`,
        })),
    }));
  }

  /** Análisis contextual con Gemini → sugerencias a la medida del MVP del proyecto. */
  private async generarConIA(project: any, ficha: any, trimestres: Trimestre[]): Promise<{ numero: number; items: any[]; fuente: SugerenciaFuente }[]> {
    const prompt = this.buildPrompt(project, ficha, trimestres);
    const json = await this.callGeminiJSON(prompt);
    const arr = Array.isArray(json?.trimestres) ? json.trimestres : [];
    return arr.map((t: any) => ({
      numero: Number(t.numero),
      fuente: SugerenciaFuente.IA,
      items: Array.isArray(t.sugerencias) ? t.sugerencias : [],
    }));
  }

  private buildPrompt(project: any, ficha: any, trimestres: Trimestre[]): string {
    const trimDesc = trimestres
      .map(t => `  - Trimestre ${t.numero} ("${t.nombre}", etapa ${t.tipo})`)
      .join('\n');

    return `Eres un arquitecto de software senior y asesor de formación del SENA (Colombia).
Analiza el siguiente PROYECTO FORMATIVO y propone módulos de trabajo ADICIONALES, enfocados en construir un MVP sólido, que complementen el ciclo de vida del software (SDLC). NO repitas módulos genéricos obvios; propón cosas específicas y útiles para ESTE proyecto.

PROYECTO:
  Nombre: ${project.nombre}
  Tipo de formación: ${ficha.tipo_formacion}
  Competencia: ${project.competencia ?? 'N/D'}
  Resultado de aprendizaje: ${project.resultado_aprendizaje ?? 'N/D'}
  Descripción: ${project.descripcion ?? 'N/D'}

TRIMESTRES (cada uno es una etapa del SDLC):
${trimDesc}

Para cada trimestre, propón entre 2 y 4 módulos adicionales relevantes a su etapa y al MVP del proyecto.
Cada módulo debe tener: nombre corto y claro, descripción (1-2 frases), categoria (una de: Documentación, Diseño, Backend, Frontend, Seguridad, Calidad, UX, DevOps, Datos, Gestión), semanas (1-6) y justificacion (por qué aporta a ESTE proyecto/MVP).

Responde ÚNICAMENTE con JSON válido, sin texto extra, con esta forma exacta:
{
  "trimestres": [
    { "numero": 1, "sugerencias": [ { "nombre": "...", "descripcion": "...", "categoria": "...", "semanas": 3, "justificacion": "..." } ] }
  ]
}`;
  }

  /** Llamada nativa a Gemini pidiendo salida JSON (responseMimeType). */
  private callGeminiJSON(prompt: string): Promise<any> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return Promise.reject(new Error('GEMINI_API_KEY no configurada'));

    const payload = JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: GEMINI_TEMPERATURE,
        maxOutputTokens: GEMINI_MAX_TOKENS,
        responseMimeType: 'application/json',
        // gemini-2.5-flash es un modelo "thinking"; sin esto, los tokens de
        // razonamiento truncan el JSON de salida. thinkingBudget=0 lo desactiva.
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: 'generativelanguage.googleapis.com',
          path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        (res) => {
          let raw = '';
          res.on('data', (c) => { raw += c; });
          res.on('end', () => {
            try {
              const json = JSON.parse(raw);
              const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (!text) {
                return reject(new Error(json?.error?.message || 'Gemini no devolvió contenido'));
              }
              resolve(JSON.parse(text));
            } catch (e: any) {
              reject(new Error('Respuesta JSON inválida de Gemini: ' + e.message));
            }
          });
        },
      );
      req.on('error', reject);
      req.setTimeout(30_000, () => { req.destroy(); reject(new Error('Timeout Gemini')); });
      req.write(payload);
      req.end();
    });
  }
}
