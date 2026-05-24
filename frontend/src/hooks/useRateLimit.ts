/**
 * useRateLimit — Limita el número de mensajes enviados por minuto.
 *
 * Implementación local (sin BD): registra timestamps en un ref y descarta
 * los que tienen más de WINDOW_MS milisegundos de antigüedad.
 *
 * Configuración: máx. 15 mensajes por ventana de 60 segundos.
 */
import { useRef, useCallback } from 'react';

const MAX_MESSAGES = 15;
const WINDOW_MS    = 60_000; // 1 minuto

export function useRateLimit() {
  const timestamps = useRef<number[]>([]);

  /** Purga los timestamps fuera de la ventana y devuelve los activos. */
  const getActive = useCallback((): number[] => {
    const now    = Date.now();
    timestamps.current = timestamps.current.filter((t) => now - t < WINDOW_MS);
    return timestamps.current;
  }, []);

  /** ¿Puede enviar un mensaje ahora? */
  const canSend = useCallback((): boolean => {
    return getActive().length < MAX_MESSAGES;
  }, [getActive]);

  /** Registra un mensaje enviado. */
  const record = useCallback((): void => {
    getActive(); // purga primero
    timestamps.current.push(Date.now());
  }, [getActive]);

  /** Milisegundos hasta que el mensaje más antiguo expire y se libere un slot. */
  const msUntilNext = useCallback((): number => {
    const active = getActive();
    if (active.length < MAX_MESSAGES) return 0;
    const oldest = Math.min(...active);
    return Math.max(0, WINDOW_MS - (Date.now() - oldest));
  }, [getActive]);

  /** Mensajes restantes en la ventana actual. */
  const remaining = useCallback((): number => {
    return Math.max(0, MAX_MESSAGES - getActive().length);
  }, [getActive]);

  return { canSend, record, msUntilNext, remaining };
}
