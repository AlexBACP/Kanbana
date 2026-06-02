/**
 * autoCapitalize — Capitalización automática GLOBAL de inputs.
 *
 * Se instala una sola vez (en main.tsx) y escucha el evento `input` en fase de
 * CAPTURA, de modo que transforma el valor ANTES de que React lo lea. Así funciona
 * con inputs controlados tanto de react-hook-form como de useState, sin tener que
 * tocar cada formulario.
 *
 * Reglas:
 *   • Inputs de texto normales  → primera letra en mayúscula (modo "sentences").
 *   • Inputs de NOMBRE          → primera letra de cada palabra en mayúscula ("words").
 *   • Correos, contraseñas, códigos, documentos, búsquedas, etc. → NO se tocan.
 *
 * Se puede forzar/desactivar por input con el atributo estándar `autoCapitalize`:
 *   autoCapitalize="words"      → cada palabra
 *   autoCapitalize="sentences"  → primera letra
 *   autoCapitalize="off"/"none" → desactivar
 */

type Mode = 'words' | 'sentences' | 'off';

// Tipos de <input> que NUNCA se capitalizan
const SKIP_TYPES = new Set([
  'email', 'password', 'number', 'tel', 'url', 'search',
  'date', 'time', 'datetime-local', 'month', 'week',
  'color', 'range', 'hidden', 'checkbox', 'radio', 'file',
]);

// inputMode que indica contenido no-textual
const SKIP_INPUTMODE = new Set(['numeric', 'tel', 'decimal', 'email', 'url', 'none']);

// Si el name/id/placeholder/aria contiene alguno de estos → no capitalizar
const SKIP_HINTS = [
  'email', 'correo', 'mail', 'password', 'contrase', 'clave',
  'codigo', 'código', 'code', 'token', 'url', 'link', 'enlace',
  'documento', 'cedula', 'cédula', 'dni', 'nit', 'telefono', 'teléfono',
  'phone', 'celular', 'usuario', 'username', 'search', 'buscar', 'query', 'slug',
];

// Si el hint contiene alguno de estos → capitalizar cada palabra (nombres propios)
const WORD_HINTS = ['nombre', 'apellido', 'name', 'programa', 'ciudad', 'empresa', 'institucion', 'institución'];

/** Capitaliza la primera letra de la cadena (respetando espacios iniciales). */
function toSentence(value: string): string {
  return value.replace(/^(\s*)(\p{L})/u, (_m, space: string, ch: string) => space + ch.toLocaleUpperCase());
}

/** Capitaliza la primera letra de cada palabra. */
function toWords(value: string): string {
  return value.replace(/(^|[\s'’\-/])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toLocaleUpperCase());
}

/** Construye una pista a partir de los atributos del input. */
function hintOf(el: HTMLInputElement | HTMLTextAreaElement): string {
  return [
    el.getAttribute('name'),
    el.id,
    el.getAttribute('placeholder'),
    el.getAttribute('aria-label'),
    el.getAttribute('autocomplete'),
  ].filter(Boolean).join(' ').toLowerCase();
}

/** Decide qué modo aplicar a un input concreto. */
function resolveMode(el: HTMLInputElement | HTMLTextAreaElement): Mode {
  // 1) Atributo explícito tiene prioridad
  const attr = (el.getAttribute('autocapitalize') || '').toLowerCase();
  if (attr === 'off' || attr === 'none') return 'off';
  if (attr === 'words' || attr === 'characters') return 'words';
  if (attr === 'sentences' || attr === 'on') return 'sentences';

  // 2) <textarea> → siempre frase (descripciones, comentarios)
  if (el instanceof HTMLTextAreaElement) return 'sentences';

  // 3) <input>: filtrar por tipo
  const type = (el.getAttribute('type') || 'text').toLowerCase();
  if (SKIP_TYPES.has(type)) return 'off';

  const inputMode = (el.getAttribute('inputmode') || '').toLowerCase();
  if (SKIP_INPUTMODE.has(inputMode)) return 'off';

  // 4) Filtrar por pista textual
  const hint = hintOf(el);
  if (SKIP_HINTS.some(h => hint.includes(h))) return 'off';
  if (WORD_HINTS.some(h => hint.includes(h))) return 'words';

  // 5) Por defecto: primera letra en mayúscula
  return 'sentences';
}

// Setters nativos para que React detecte el cambio (saltando el value-tracker)
const inputSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
const textareaSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const setter = el instanceof HTMLTextAreaElement ? textareaSetter : inputSetter;
  if (setter) setter.call(el, value);
  else el.value = value;
}

function handleInput(e: Event) {
  // No interferir con composición de acentos / IME
  if ((e as InputEvent).isComposing) return;

  const el = e.target as HTMLElement | null;
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return;

  const mode = resolveMode(el);
  if (mode === 'off') return;

  const value = el.value;
  if (!value) return;

  const next = mode === 'words' ? toWords(value) : toSentence(value);
  if (next === value) return; // sin cambios → no tocar el cursor

  // La transformación no cambia la longitud → el cursor se mantiene
  const start = el.selectionStart;
  const end = el.selectionEnd;
  setNativeValue(el, next);
  try {
    if (start != null && end != null) el.setSelectionRange(start, end);
  } catch {
    /* algunos tipos de input no permiten setSelectionRange */
  }
}

let installed = false;

/** Instala la capitalización automática global. Llamar una sola vez. */
export function installAutoCapitalize() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  // Fase de captura: corre ANTES del listener de React (que está en el root)
  document.addEventListener('input', handleInput, true);
}
