// ── NUEVO ARCHIVO ─────────────────────────────────────────────────────────────
// Tipos TypeScript para Trimestre y TicketAttachment.
// Se usan en components, pages y services relacionados con trimestres y adjuntos.
// ─────────────────────────────────────────────────────────────────────────────

export type TipoTrimestre = 'documental' | 'desarrollo';

// Representa un trimestre dentro de un proyecto formativo.
// T1 siempre es documental; los siguientes suelen ser de desarrollo.
export interface Trimestre {
  id: number;
  numero: number;           // 1 a 10
  nombre: string;           // "Trimestre 1" o personalizado
  tipo: TipoTrimestre;      // 'documental' | 'desarrollo'
  fecha_inicio: string;
  fecha_fin: string;
  esta_finalizado: boolean;
  proyecto_id: number;
  creado_en: string;
  sprints?: TrimesteSprint[];
}

// Sprint simplificado dentro de la vista de trimestre
export interface TrimesteSprint {
  id: number;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  esta_activo: boolean;
  esta_finalizado: boolean;
  trimestre_id: number;
  tickets?: { id: number; titulo: string; estado: string }[];
}

// Archivo adjunto subido a un ticket
export interface TicketAttachment {
  id: number;
  ticket_id: number;
  nombre_original: string;  // nombre que ve el usuario: "IEEE_830.pdf"
  nombre_disco: string;     // UUID en el servidor: "a3f8c2d1.pdf"
  url: string;              // URL pública para descargar
  tipo_mime: string;        // "application/pdf", "image/png", etc.
  tamano_bytes: number;     // para mostrar "2.4 MB"
  subido_por_id: number;
  subido_por?: { id: number; nombre: string };
  creado_en: string;
}

// DTO para crear un trimestre manualmente
export interface CreateTrimestreDto {
  numero: number;
  nombre?: string;
  tipo?: TipoTrimestre;
  fecha_inicio: string;
  fecha_fin: string;
}