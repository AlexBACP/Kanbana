// ── MODIFICADO ───────────────────────────────────────────────────────────────
// Cambios respecto a la versión original:
//  1. Se importa Trimestre desde trimestre.types.
//  2. Se agrega trimestres?: Trimestre[] a la interfaz Project.
//  3. Se agrega num_trimestres a la interfaz Project.
//  4. Se agrega trimestre_id?: number a la interfaz Sprint.
//  5. Se agrega num_trimestres y trimestres a CreateProjectDto.
// ─────────────────────────────────────────────────────────────────────────────

import { Ticket }     from './ticket.types';
// ── NUEVO IMPORT ──────────────────────────────────────────────────────────────
import { Trimestre, CreateTrimestreDto } from './trimestre.types';

export type ProjectStatus = 'activo' | 'pausado' | 'finalizado';

export interface Project {
  id: number;
  nombre: string;
  descripcion: string;
  ficha_id: number;
  ficha?: {
    id: number;
    codigo: string;
    programa: string;
  };
  competencia: string;
  resultado_aprendizaje: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: ProjectStatus;
  creado_en: string;
  // ── NUEVO: cantidad de trimestres del proyecto ────────────────────────────
  num_trimestres: number;
  sprints?: Sprint[];
  // ── NUEVO: trimestres del proyecto ───────────────────────────────────────
  trimestres?: Trimestre[];
}

export interface Sprint {
  id: number;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  esta_activo: boolean;
  esta_finalizado: boolean;
  proyecto_id: number;
  // ── NUEVO: FK al trimestre al que pertenece ───────────────────────────────
  trimestre_id?: number;
  trimestre?: {
    id: number;
    numero: number;
    tipo: 'documental' | 'desarrollo';
  };
  creado_en: string;
  tickets?: Ticket[];
}

export interface CreateProjectDto {
  nombre: string;
  descripcion: string;
  ficha_id: number;
  competencia: string;
  resultado_aprendizaje: string;
  fecha_inicio: string;
  fecha_fin: string;
  // ── NUEVO: cuántos trimestres tendrá el proyecto (1, 2 o 3) ──────────────
  // El backend genera los trimestres automáticamente con este valor.
  num_trimestres?: number;
  // ── NUEVO: fechas y nombres personalizados por trimestre (opcional) ───────
  // Si no se envía, el backend divide el tiempo equitativamente.
  trimestres?: CreateTrimestreDto[];
}

export interface CreateSprintDto {
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  // ── NUEVO: trimestre al que pertenece este sprint ─────────────────────────
  trimestre_id?: number;
}