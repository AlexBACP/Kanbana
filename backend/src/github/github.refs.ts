/**
 * Detección de referencias a tickets dentro de textos de GitHub
 * (mensajes de commit, nombres de rama, títulos/cuerpos de PR).
 *
 * Formatos soportados, todos resolviendo al id numérico del ticket:
 *   KAN-32   →  32   (prefijo configurable vía GITHUB_TICKET_PREFIX, default "KAN")
 *   #32      →  32
 *
 * Ejemplos:
 *   "feature/KAN-32-auth-jwt"            → 32
 *   "KAN-32 agrega refresh token"        → 32
 *   "Fixes #15 and KAN-7"                → [15, 7]
 */
const PREFIX = (process.env.GITHUB_TICKET_PREFIX || 'KAN').trim();

/** Devuelve TODOS los ids de ticket referenciados en un texto (sin duplicados). */
export function parseTicketRefs(text: string | null | undefined): number[] {
  if (!text) return [];
  const ids = new Set<number>();

  // KAN-32  (prefijo, separador - o _, número)
  const prefixRe = new RegExp(`\\b${PREFIX}[-_](\\d+)\\b`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = prefixRe.exec(text)) !== null) {
    ids.add(parseInt(m[1], 10));
  }

  // #32
  const hashRe = /#(\d+)\b/g;
  while ((m = hashRe.exec(text)) !== null) {
    ids.add(parseInt(m[1], 10));
  }

  return [...ids].filter((n) => Number.isInteger(n) && n > 0);
}

/** Devuelve el PRIMER id de ticket referenciado, o null. */
export function parseFirstTicketRef(text: string | null | undefined): number | null {
  const refs = parseTicketRefs(text);
  return refs.length ? refs[0] : null;
}
