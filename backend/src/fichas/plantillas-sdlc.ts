/**
 * Plantillas del Ciclo de Vida del Software (SDLC) aplicadas a la formación SENA.
 *
 * Datos curriculares verificados (fuentes en docs/sena-references.md):
 *  - Tecnólogo en Análisis y Desarrollo de Software (ADSO):
 *      Duración total: 27 meses · 3.984 horas totales.
 *      Etapa lectiva: 7 trimestres · 3.120 horas.
 *      Etapa productiva: 2 trimestres (no se modelan en el sistema).
 *  - Técnico en Programación de Software:
 *      Etapa lectiva: 3 trimestres · ~2.208 horas totales (incluye productiva).
 *      Etapa productiva: 2 trimestres.
 *
 *  - SWEBOK v3 / ISO/IEC/IEEE 12207:2017 — Fases del SDLC: planificación,
 *    análisis de requerimientos, diseño, implementación, pruebas, despliegue,
 *    mantenimiento.
 *
 * Cada trimestre dura ~12 semanas. La suma de `semanas` de los módulos
 * de un trimestre debería dar 12.
 */

import { TipoTrimestre } from '../projects/entities/trimestre.entity';

export interface ModuloPlantilla {
  /** Nombre del módulo (será el `nombre` del sprint generado). */
  nombre: string;
  /** Descripción mostrada en la UI y en el detalle del módulo. */
  descripcion: string;
  /** Duración en semanas; la suma del trimestre debería dar 12. */
  semanas: number;
  /**
   * Si true, los tickets del sprint requerirán al menos un adjunto antes
   * de pasar a 'done'. Se aplica para módulos documentales (IEEE 830, UML, etc.).
   */
  requiere_adjunto?: boolean;
}

export interface TrimestrePlantilla {
  /** Nombre semántico del trimestre. */
  nombre: string;
  /** Descripción general / etapa del SDLC que cubre. */
  descripcion: string;
  /** documental → tickets requieren entregable; desarrollo → flujo de código normal. */
  tipo: TipoTrimestre;
  /** Lista de módulos predeterminados (sprints) que se sugieren al crear el proyecto. */
  modulos: ModuloPlantilla[];
}

// ═════════════════════════════════════════════════════════════════════════════
// TECNÓLOGO ADSO — 7 trimestres lectivos (21 meses ≈ 3.120 horas)
// Programa "Análisis y Desarrollo de Software" del SENA.
// ═════════════════════════════════════════════════════════════════════════════
export const PLANTILLA_TECNOLOGO: TrimestrePlantilla[] = [
  {
    nombre:      'T1 — Levantamiento de requerimientos',
    descripcion: 'Identificación del problema, análisis de stakeholders y especificación de requerimientos. Salida principal: documento IEEE 830.',
    tipo:        TipoTrimestre.DOCUMENTAL,
    modulos: [
      { nombre: 'Entrevistas y análisis de stakeholders',         descripcion: 'Levantamiento del contexto, entrevistas con usuarios y documentación inicial del problema.', semanas: 4, requiere_adjunto: true },
      { nombre: 'IEEE 830 — Especificación de requerimientos',    descripcion: 'Redacción del documento de requerimientos funcionales y no funcionales bajo el estándar IEEE 830.', semanas: 4, requiere_adjunto: true },
      { nombre: 'Casos de uso y diagramas iniciales',             descripcion: 'Modelado de casos de uso, actores y diagramas de contexto del sistema.', semanas: 4, requiere_adjunto: true },
    ],
  },
  {
    nombre:      'T2 — Análisis del sistema',
    descripcion: 'Modelado UML completo, refinamiento de casos de uso y modelado de procesos de negocio (BPMN).',
    tipo:        TipoTrimestre.DOCUMENTAL,
    modulos: [
      { nombre: 'Diagramas UML estructurales (clases, componentes)', descripcion: 'Diagramas de clases, paquetes y componentes que describen la estructura del sistema.', semanas: 4, requiere_adjunto: true },
      { nombre: 'Diagramas UML de comportamiento (secuencia, estado)', descripcion: 'Diagramas de secuencia, estado y actividad para los flujos críticos del sistema.', semanas: 4, requiere_adjunto: true },
      { nombre: 'Modelado de procesos de negocio (BPMN)',          descripcion: 'Mapeo de procesos AS-IS y TO-BE con notación BPMN 2.0.', semanas: 4, requiere_adjunto: true },
    ],
  },
  {
    nombre:      'T3 — Diseño del sistema',
    descripcion: 'Diseño de la base de datos, definición de la arquitectura y patrones del software.',
    tipo:        TipoTrimestre.DOCUMENTAL,
    modulos: [
      { nombre: 'Modelo entidad-relación y normalización',        descripcion: 'Modelo ER, modelo relacional y normalización hasta 3FN. Diccionario de datos.', semanas: 4, requiere_adjunto: true },
      { nombre: 'Arquitectura del sistema (C4 + patrones)',       descripcion: 'Vistas C4 (Contexto, Contenedores, Componentes), estilo arquitectónico y patrones de diseño.', semanas: 4, requiere_adjunto: true },
      { nombre: 'Diseño de seguridad y control de acceso',        descripcion: 'Modelo de roles, permisos y mecanismos de autenticación/autorización.', semanas: 4, requiere_adjunto: true },
    ],
  },
  {
    nombre:      'T4 — Diseño detallado y prototipado',
    descripcion: 'Wireframes, prototipos UX/UI, especificación técnica de APIs y plan de pruebas.',
    tipo:        TipoTrimestre.DOCUMENTAL,
    modulos: [
      { nombre: 'Wireframes y prototipos UX/UI',                  descripcion: 'Diseño visual en Figma/Adobe XD, sistema de diseño y flujos de navegación.', semanas: 4, requiere_adjunto: true },
      { nombre: 'Especificación técnica de APIs (OpenAPI)',       descripcion: 'Contratos REST/GraphQL formalizados con OpenAPI 3.0 / Swagger.', semanas: 4, requiere_adjunto: true },
      { nombre: 'Plan de pruebas y estrategia de QA',             descripcion: 'Plan de pruebas unitarias, integración y E2E. Estrategia de QA y criterios de aceptación.', semanas: 4, requiere_adjunto: true },
    ],
  },
  {
    nombre:      'T5 — Implementación backend',
    descripcion: 'Construcción del lado servidor: capa de datos, lógica de negocio y APIs.',
    tipo:        TipoTrimestre.DESARROLLO,
    modulos: [
      { nombre: 'Configuración del entorno y framework',          descripcion: 'Bootstrapping del proyecto, control de versiones, dependencias, linter y formatter.', semanas: 3 },
      { nombre: 'Capa de datos y modelos (ORM)',                   descripcion: 'Entidades, migraciones, repositorios, seeders y conexión a la BD.', semanas: 4 },
      { nombre: 'APIs REST y autenticación',                      descripcion: 'Endpoints CRUD, autenticación JWT, autorización por roles, validaciones y manejo de errores.', semanas: 5 },
    ],
  },
  {
    nombre:      'T6 — Implementación frontend e integración',
    descripcion: 'Construcción del lado cliente y conexión con el backend.',
    tipo:        TipoTrimestre.DESARROLLO,
    modulos: [
      { nombre: 'Componentes UI y maquetación',                    descripcion: 'Implementación de la interfaz con un framework moderno (React/Vue/Angular) y el sistema de diseño.', semanas: 4 },
      { nombre: 'Integración frontend ↔ backend',                  descripcion: 'Conexión de la UI con las APIs, manejo de estado, autenticación y enrutamiento.', semanas: 4 },
      { nombre: 'Testing unitario e integración',                  descripcion: 'Pruebas con Jest/Vitest, cobertura mínima del 70% en lógica crítica y pruebas de integración.', semanas: 4 },
    ],
  },
  {
    nombre:      'T7 — Pruebas, despliegue y entrega',
    descripcion: 'Pruebas finales, despliegue en producción, documentación y capacitación al usuario.',
    tipo:        TipoTrimestre.DESARROLLO,
    modulos: [
      { nombre: 'Pruebas de aceptación (UAT) y E2E',              descripcion: 'Validación funcional con el cliente, automatización de flujos críticos y corrección de defectos.', semanas: 4, requiere_adjunto: true },
      { nombre: 'Despliegue en producción (CI/CD)',                descripcion: 'Pipeline de CI/CD, contenedores Docker, configuración del servidor y dominio.', semanas: 4 },
      { nombre: 'Documentación final y capacitación',              descripcion: 'Manual técnico, manual de usuario, video tutorial y sesión de capacitación al cliente.', semanas: 4, requiere_adjunto: true },
    ],
  },
];

// ═════════════════════════════════════════════════════════════════════════════
// TÉCNICO — 3 trimestres lectivos
// Programa "Programación de Software" / "Sistemas" del SENA.
// ═════════════════════════════════════════════════════════════════════════════
export const PLANTILLA_TECNICO: TrimestrePlantilla[] = [
  {
    nombre:      'T1 — Análisis y diseño',
    descripcion: 'Levantamiento de requerimientos, casos de uso y diseño del sistema.',
    tipo:        TipoTrimestre.DOCUMENTAL,
    modulos: [
      { nombre: 'Requerimientos y casos de uso',                  descripcion: 'Especificación de requerimientos funcionales y modelado de casos de uso.', semanas: 6, requiere_adjunto: true },
      { nombre: 'Diseño de base de datos y modelado',             descripcion: 'Modelo entidad-relación, normalización y prototipos básicos de UI.', semanas: 6, requiere_adjunto: true },
    ],
  },
  {
    nombre:      'T2 — Desarrollo',
    descripcion: 'Implementación del sistema: backend, frontend e integración.',
    tipo:        TipoTrimestre.DESARROLLO,
    modulos: [
      { nombre: 'Implementación backend',                          descripcion: 'Construcción de la capa de datos, APIs y autenticación.', semanas: 6 },
      { nombre: 'Implementación frontend',                         descripcion: 'Maquetación de la interfaz e integración con el backend.', semanas: 6 },
    ],
  },
  {
    nombre:      'T3 — Pruebas y despliegue',
    descripcion: 'Aseguramiento de calidad, despliegue en producción y entrega.',
    tipo:        TipoTrimestre.DESARROLLO,
    modulos: [
      { nombre: 'Testing y aseguramiento de calidad',              descripcion: 'Pruebas unitarias, de integración y aceptación. Corrección de bugs.', semanas: 6 },
      { nombre: 'Despliegue y entrega final',                      descripcion: 'Despliegue en producción, documentación y capacitación al usuario.', semanas: 6, requiere_adjunto: true },
    ],
  },
];

export const PLANTILLAS_POR_TIPO = {
  tecnologo: PLANTILLA_TECNOLOGO,
  tecnico:   PLANTILLA_TECNICO,
} as const;

// ═════════════════════════════════════════════════════════════════════════════
// CATÁLOGO DE SUGERENCIAS DE MÓDULOS ADICIONALES
// Para cuando el líder quiere proponer un módulo extra fuera de la plantilla.
// Se filtra según la etapa del SDLC (trimestre actual) para mostrar opciones
// relevantes al momento del proyecto.
// ═════════════════════════════════════════════════════════════════════════════
export interface SugerenciaModulo {
  categoria:   string;
  nombre:      string;
  descripcion: string;
  /** Trimestres en los que la sugerencia es más relevante (1-indexed, sobre 7). */
  trimestres_relevantes: number[];
}

export const CATALOGO_SUGERENCIAS: SugerenciaModulo[] = [
  // Documentación
  { categoria: 'Documentación', nombre: 'Manual de usuario',                  descripcion: 'Guía paso a paso para el usuario final con capturas y casos típicos.',           trimestres_relevantes: [4, 7] },
  { categoria: 'Documentación', nombre: 'Manual técnico de instalación',      descripcion: 'Requisitos, dependencias, comandos y configuración para desplegar el sistema.', trimestres_relevantes: [4, 7] },
  { categoria: 'Documentación', nombre: 'Documento de arquitectura (C4)',     descripcion: 'Vistas C4 (Contexto, Contenedores, Componentes, Código) del sistema.',           trimestres_relevantes: [3, 4] },
  { categoria: 'Documentación', nombre: 'Diccionario de datos',               descripcion: 'Definición formal de cada entidad, atributo y restricción de la BD.',            trimestres_relevantes: [3] },

  // Seguridad
  { categoria: 'Seguridad',     nombre: 'Auditoría OWASP Top 10',             descripcion: 'Análisis y mitigación de las 10 vulnerabilidades más críticas (OWASP 2021).',    trimestres_relevantes: [6, 7] },
  { categoria: 'Seguridad',     nombre: 'Autenticación 2FA',                  descripcion: 'Implementación de autenticación de dos factores (TOTP, SMS o correo).',          trimestres_relevantes: [5, 6] },
  { categoria: 'Seguridad',     nombre: 'Análisis de dependencias (CVE)',     descripcion: 'Escaneo de paquetes con npm audit / Snyk / Dependabot y actualización.',         trimestres_relevantes: [6, 7] },
  { categoria: 'Seguridad',     nombre: 'Cifrado y manejo de secretos',       descripcion: 'Cifrado de datos sensibles, uso de variables de entorno y vaults.',              trimestres_relevantes: [5, 6] },

  // Calidad
  { categoria: 'Calidad',       nombre: 'Pruebas E2E (Cypress / Playwright)', descripcion: 'Automatización de los flujos críticos del usuario punta a punta.',               trimestres_relevantes: [6, 7] },
  { categoria: 'Calidad',       nombre: 'Análisis estático (SonarQube)',      descripcion: 'Integración de análisis estático en el pipeline para mantener calidad de código.', trimestres_relevantes: [5, 6] },
  { categoria: 'Calidad',       nombre: 'Pruebas de carga y rendimiento',     descripcion: 'Pruebas con k6 / JMeter, identificación de cuellos de botella y optimización.',  trimestres_relevantes: [6, 7] },
  { categoria: 'Calidad',       nombre: 'Code review estructurado',           descripcion: 'Implementación de checklist de revisión de código y políticas de PR.',           trimestres_relevantes: [5, 6, 7] },

  // UX
  { categoria: 'UX',            nombre: 'Estudio UX (entrevistas + heurísticas)', descripcion: 'Entrevistas con usuarios reales y evaluación heurística de Nielsen.',        trimestres_relevantes: [1, 4] },
  { categoria: 'UX',            nombre: 'Sistema de diseño / Design tokens',  descripcion: 'Tokens de color, espaciado y tipografía, biblioteca de componentes reutilizable.', trimestres_relevantes: [4, 6] },
  { categoria: 'UX',            nombre: 'Pruebas de usabilidad',              descripcion: 'Sesiones moderadas con usuarios reales para validar la interfaz.',                 trimestres_relevantes: [6, 7] },
  { categoria: 'UX',            nombre: 'Accesibilidad WCAG 2.1',             descripcion: 'Auditoría de accesibilidad y ajustes para cumplir WCAG nivel AA.',                trimestres_relevantes: [6, 7] },

  // DevOps
  { categoria: 'DevOps',        nombre: 'Pipeline CI/CD (GitHub Actions)',    descripcion: 'Pipeline de build, test y deploy automatizado en cada push a main.',             trimestres_relevantes: [5, 7] },
  { categoria: 'DevOps',        nombre: 'Containerización con Docker',        descripcion: 'Dockerfile multi-stage para el backend y el frontend, listo para producción.',  trimestres_relevantes: [5, 7] },
  { categoria: 'DevOps',        nombre: 'Monitoreo (Grafana + Prometheus)',   descripcion: 'Recopilación de métricas, dashboards y alertas para producción.',                trimestres_relevantes: [7] },
  { categoria: 'DevOps',        nombre: 'Logs centralizados (ELK / Loki)',    descripcion: 'Agregación de logs, búsqueda y alertas operacionales.',                          trimestres_relevantes: [7] },

  // Gestión
  { categoria: 'Gestión',       nombre: 'Refinamiento del backlog',           descripcion: 'Sesión de grooming: priorizar, estimar y dividir historias del próximo trimestre.', trimestres_relevantes: [1, 2, 3, 4, 5, 6, 7] },
  { categoria: 'Gestión',       nombre: 'Retrospectiva del trimestre',        descripcion: 'Qué funcionó, qué no, acciones de mejora para el siguiente trimestre.',          trimestres_relevantes: [1, 2, 3, 4, 5, 6, 7] },
  { categoria: 'Gestión',       nombre: 'Capacitación al usuario final',      descripcion: 'Sesiones presenciales / virtuales para entrenar a los usuarios en el uso del sistema.', trimestres_relevantes: [7] },
];
