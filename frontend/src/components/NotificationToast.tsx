/**
 * NotificationToast — Toasts inteligentes de notificaciones en tiempo real.
 *
 * Comportamiento:
 *  • Funciona en CUALQUIER vista (tablero, detalle, dashboard, etc.).
 *  • Si el ícono de la campana del TopBar está visible (id="topbar-bell"),
 *    el toast "emana" debajo de la campana con una animación tipo paloma.
 *  • Si no hay TopBar (p.ej. pantallas pre-login o de espera), cae en la
 *    esquina inferior derecha — el comportamiento de antes.
 *  • Al hacer clic, navega al destino más relevante (acción/ref → /tickets/X,
 *    /projects/X/kanban...). Si no se infiere destino, abre el panel /dashboard.
 *
 * Se monta una sola vez en App.tsx (dentro de BrowserRouter).
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence }  from 'framer-motion';
import {
  Bell, X, CheckCircle2, AlertTriangle, Clock, Ticket,
} from 'lucide-react';
import { useNotificationStore } from '../store/notification.store';
import { useAuthStore }         from '../store/auth.store';
import type { Notification, NotificationType } from '../types/notification.types';
import { notifTarget } from '../utils/notifTarget';

// ── Estilos por tipo ─────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  info:                  { icon: Bell,          color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/25'    },
  success:               { icon: CheckCircle2,  color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25' },
  warning:               { icon: AlertTriangle, color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/25'   },
  error:                 { icon: AlertTriangle, color: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/25'    },
  ticket_asignado:       { icon: Ticket,        color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20'    },
  ticket_en_revision:    { icon: Clock,         color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20'   },
  ticket_aprobado:       { icon: CheckCircle2,  color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  ticket_devuelto:       { icon: AlertTriangle, color: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/20'    },
  evidencia_aprobada:    { icon: CheckCircle2,  color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  evidencia_rechazada:   { icon: AlertTriangle, color: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/20'    },
  fecha_limite_proxima:  { icon: Clock,         color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20'   },
};

interface Toast {
  id:      number;
  titulo?: string;
  mensaje: string;
  tipo:    NotificationType;
  target:  string | null;
}

// Posición del ancla (campana) en coordenadas absolutas
interface Anchor { top: number; left: number; }

// Busca la campana visible y devuelve su posición (centro inferior del botón)
function findBellAnchor(): Anchor | null {
  const el = document.getElementById('topbar-bell');
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  // Si el botón está fuera de pantalla (oculto), también lo descartamos
  if (rect.width === 0 && rect.height === 0) return null;
  return { top: rect.bottom + 10, left: rect.left + rect.width / 2 };
}

// Brinquito de la campana cuando llega un toast (efecto visual)
function pingBell() {
  const el = document.getElementById('topbar-bell');
  if (!el) return;
  el.animate(
    [
      { transform: 'scale(1)'   },
      { transform: 'scale(1.25) rotate(-12deg)' },
      { transform: 'scale(1.1)  rotate(10deg)'  },
      { transform: 'scale(1)'   },
    ],
    { duration: 600, easing: 'cubic-bezier(0.4,0,0.2,1)' },
  );
}

export const NotificationToast = () => {
  const [toasts, setToasts]   = useState<Toast[]>([]);
  const [anchor, setAnchor]   = useState<Anchor | null>(null);
  const { notifications }     = useNotificationStore();
  const { settings }          = useAuthStore();
  const navigate              = useNavigate();
  const location              = useLocation();
  const lastSeenRef           = useRef<number>(0);

  // Re-localizar la campana al cambiar de ruta o al redimensionar la ventana
  useEffect(() => {
    const update = () => setAnchor(findBellAnchor());
    update();
    window.addEventListener('resize', update);
    // Pequeño delay para esperar el render de la nueva vista
    const t = setTimeout(update, 100);
    return () => { window.removeEventListener('resize', update); clearTimeout(t); };
  }, [location.pathname]);

  // Detectar TODAS las notificaciones nuevas del store (no solo la primera)
  useEffect(() => {
    if (!settings.notificationsEnabled) return;
    if (!notifications.length) return;

    // Buscar todas las notificaciones nuevas (id > último visto) que no estén leídas
    const nuevas = (notifications as Notification[])
      .filter(n => n.id > lastSeenRef.current && !n.leida);

    if (nuevas.length === 0) return;

    // Actualizar el "último visto" al id más grande
    lastSeenRef.current = Math.max(...nuevas.map(n => n.id));

    if (import.meta.env.DEV) {
      console.log(`[NotificationToast] ${nuevas.length} nueva(s) notificación(es):`, nuevas);
    }

    // Re-localizar la campana en el momento exacto en que llegan los toasts
    const a = findBellAnchor();
    setAnchor(a);
    if (a) pingBell();

    // Convertir cada notificación nueva a Toast
    const nuevosToasts: Toast[] = nuevas.map(n => ({
      id:      n.id,
      titulo:  n.titulo,
      mensaje: n.mensaje,
      tipo:    n.tipo,
      target:  notifTarget(n),
    }));

    // Mostrar todos los nuevos (máx 4 visibles a la vez)
    setToasts(prev => [...nuevosToasts, ...prev].slice(0, 4));

    // Notificación del SO si la pestaña está en segundo plano (solo el más reciente)
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        const latest = nuevas[0];
        const sys = new Notification('Kanbana', {
          body: latest.mensaje,
          icon: '/favicon.svg',
          tag:  `kanbana-${latest.id}`,
        });
        sys.onclick = () => {
          window.focus();
          const tgt = notifTarget(latest);
          if (tgt) navigate(tgt);
          sys.close();
        };
      } catch { /* algunos navegadores limitan fuera de user-gesture */ }
    }

    // Auto-dismiss 20s por toast — tiempo generoso para leer y reaccionar
    const tids = nuevosToasts.map(t =>
      setTimeout(() => {
        setToasts(prev => prev.filter(x => x.id !== t.id));
      }, 20_000),
    );
    return () => tids.forEach(clearTimeout);
  }, [notifications]); // eslint-disable-line

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const open = useCallback((t: Toast) => {
    dismiss(t.id);
    if (t.target) navigate(t.target);
  }, [navigate, dismiss]);

  // Si hay campana visible → modo "ancla bajo la campana"
  // Si no → modo "esquina inferior derecha"
  const usingAnchor = !!anchor;

  // Posición del contenedor (porta el clip de movimiento natural)
  const containerStyle: React.CSSProperties = usingAnchor
    ? { position: 'fixed', top: anchor!.top, left: anchor!.left, transform: 'translateX(-92%)', zIndex: 200, pointerEvents: 'none' }
    : { position: 'fixed', bottom: 24, right: 24, zIndex: 200, pointerEvents: 'none' };

  // Animación: si emana de la campana, sube y baja desde -8px con escala
  const motionInitial = usingAnchor
    ? { opacity: 0, y: -16, scale: 0.7 }
    : { opacity: 0, x: 40, scale: 0.9 };
  const motionAnimate = usingAnchor
    ? { opacity: 1, y: 0, scale: 1 }
    : { opacity: 1, x: 0, scale: 1 };
  const motionExit = usingAnchor
    ? { opacity: 0, y: -10, scale: 0.85 }
    : { opacity: 0, x: 40, scale: 0.9 };

  return createPortal(
    <div style={containerStyle} className="flex flex-col gap-2">
      {/* Triangulito apuntando a la campana cuando estamos anclados */}
      {usingAnchor && toasts.length > 0 && (
        <div className="self-end mr-3 -mb-1 w-3 h-3 rotate-45 bg-zinc-900 border-t border-l border-zinc-700/60 shadow" />
      )}
      <AnimatePresence>
        {toasts.map(t => {
          const cfg = TYPE_CONFIG[t.tipo as string] ?? TYPE_CONFIG.info;
          const Icon = cfg.icon;
          return (
            <motion.div
              key={t.id}
              initial={motionInitial}
              animate={motionAnimate}
              exit={motionExit}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              className="pointer-events-auto"
            >
              <div
                onClick={() => open(t)}
                title={t.target ? 'Click para abrir' : undefined}
                className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-2xl ${t.target ? 'cursor-pointer' : 'cursor-default'}
                            bg-zinc-900 ${cfg.border} hover:bg-zinc-800 transition-colors max-w-xs`}
              >
                <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
                  <Icon size={15} className={cfg.color} />
                </div>
                <div className="flex-1 min-w-0">
                  {t.titulo && <p className="text-[12px] font-black text-zinc-100 leading-snug">{t.titulo}</p>}
                  <p className={`text-xs leading-snug ${t.titulo ? 'text-zinc-400 mt-0.5' : 'font-bold text-zinc-200'}`}>{t.mensaje}</p>
                  {t.target && <p className="text-[10px] text-blue-400 mt-1 font-bold">Abrir →</p>}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); dismiss(t.id); }}
                  className="text-zinc-600 hover:text-zinc-300 transition-colors shrink-0 mt-0.5"
                >
                  <X size={12} />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>,
    document.body,
  );
};
