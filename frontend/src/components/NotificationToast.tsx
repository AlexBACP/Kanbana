/**
 * NotificationToast — Toast de notificaciones en tiempo real.
 *
 * Se muestra en la esquina inferior derecha cuando llega
 * una notificación por WebSocket.
 *
 * Montado una sola vez en App.tsx (dentro de BrowserRouter).
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate }                        from 'react-router-dom';
import { motion, AnimatePresence }            from 'framer-motion';
import { Bell, X, CheckCircle2, AlertTriangle, Clock, Ticket } from 'lucide-react';
import { useNotificationStore }               from '../store/notification.store';
import { useAuthStore }                       from '../store/auth.store';
import { NotificationType }                   from '../types/notification.types';

// ── Iconos y colores por tipo de notificación ─────────────────────────────────
const TYPE_CONFIG: Record<NotificationType, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  ticket_asignado:       { icon: Ticket,        color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20'    },
  ticket_en_revision:    { icon: Clock,         color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20'   },
  ticket_aprobado:       { icon: CheckCircle2,  color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  ticket_devuelto:       { icon: AlertTriangle, color: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/20'    },
  evidencia_aprobada:    { icon: CheckCircle2,  color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  evidencia_rechazada:   { icon: AlertTriangle, color: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/20'    },
  fecha_limite_proxima:  { icon: Clock,         color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20'   },
};

interface Toast {
  id:           number;
  mensaje:      string;
  tipo:         NotificationType;
  referencia_id: number;
  referencia_tipo: string;
}

export const NotificationToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const { notifications }   = useNotificationStore();
  const { settings }        = useAuthStore();
  const navigate            = useNavigate();
  const lastSeenRef         = useRef<number>(0);

  // Detectar nuevas notificaciones en el store
  useEffect(() => {
    if (!settings.notificationsEnabled) return;
    if (!notifications.length) return;
    const latest = notifications[0];
    if (!latest || lastSeenRef.current === latest.id) return;

    // Evitar mostrar notificaciones viejas (leídas o anteriores a la sesión)
    if (latest.leida) return;

    lastSeenRef.current = latest.id;

    const toast: Toast = {
      id:              latest.id,
      mensaje:         latest.mensaje,
      tipo:            latest.tipo,
      referencia_id:   latest.referencia_id,
      referencia_tipo: latest.referencia_tipo,
    };

    setToasts(prev => [toast, ...prev].slice(0, 4));

    // ── Notificación del SISTEMA (navegador) ───────────────────────────────
    // Si el permiso está concedido, dispara una notificación nativa del SO.
    // Útil sobre todo cuando la pestaña está en segundo plano (document.hidden).
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        const sysNotif = new Notification('Kanbana', {
          body: latest.mensaje,
          icon: '/favicon.ico',
          tag:  `kanbana-${latest.id}`,
        });
        sysNotif.onclick = () => {
          window.focus();
          if (latest.referencia_tipo === 'ticket' && latest.referencia_id) {
            navigate(`/tickets/${latest.referencia_id}`);
          }
          sysNotif.close();
        };
      } catch { /* algunos navegadores limitan Notification fuera de user-gesture */ }
    }

    // Auto-dismiss después de 5s
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== latest.id));
    }, 5000);
  }, [notifications]); // eslint-disable-line

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const handleClick = useCallback((toast: Toast) => {
    dismiss(toast.id);
    if (toast.referencia_tipo === 'ticket' && toast.referencia_id) {
      navigate(`/tickets/${toast.referencia_id}`);
    }
  }, [navigate, dismiss]);

  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map(toast => {
          const cfg = TYPE_CONFIG[toast.tipo] ?? {
            icon: Bell, color: 'text-zinc-400', bg: 'bg-zinc-800', border: 'border-zinc-700'
          };
          const Icon = cfg.icon;

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 40, scale: 0.9 }}
              animate={{ opacity: 1, x: 0,  scale: 1   }}
              exit={{   opacity: 0, x: 40,  scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto"
            >
              <div
                onClick={() => handleClick(toast)}
                className={`
                  flex items-start gap-3 px-4 py-3 rounded-xl border shadow-2xl cursor-pointer
                  bg-zinc-900 ${cfg.border}
                  hover:bg-zinc-800 transition-colors max-w-xs
                `}
              >
                <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
                  <Icon size={15} className={cfg.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-zinc-200 leading-snug">{toast.mensaje}</p>
                  {toast.referencia_tipo === 'ticket' && (
                    <p className="text-[10px] text-zinc-500 mt-0.5">Click para ver la tarea</p>
                  )}
                </div>
                <button
                  onClick={e => { e.stopPropagation(); dismiss(toast.id); }}
                  className="text-zinc-600 hover:text-zinc-300 transition-colors shrink-0 mt-0.5"
                >
                  <X size={12} />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};