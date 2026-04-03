import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, Trash2, AlertCircle, Info, CheckCircle2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { notificationService } from '../../services/notification.service';

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  success: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  error: { icon: AlertCircle, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' },
};

export const NotificationsPanel = () => {
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationService.getAll,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) => notificationService.markAsRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllMutation = useMutation({
    mutationFn: notificationService.markAllAsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unread = (notifications as any[]).filter((n: any) => !n.leida).length;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">Notificaciones</h2>
          <p className="text-dark-muted text-sm font-bold mt-1">
            {unread > 0 ? `${unread} sin leer` : 'Todo al día'}
          </p>
        </div>
        {unread > 0 && (
          <button
            onClick={() => markAllMutation.mutate()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600/10 text-primary-400 border border-primary-500/20 text-xs font-black uppercase tracking-widest hover:bg-primary-600/20 transition-all"
          >
            <CheckCheck size={14} />
            Marcar todas como leídas
          </button>
        )}
      </div>

      <div className="space-y-3">
        {isLoading ? (
          [1, 2, 3].map(n => (
            <div key={n} className="h-20 bg-dark-card/50 rounded-2xl animate-pulse border border-dark-border" />
          ))
        ) : (notifications as any[]).length === 0 ? (
          <div className="text-center py-16 bg-dark-card/20 rounded-[2rem] border border-dashed border-dark-border">
            <Bell size={40} className="mx-auto text-dark-muted mb-4 opacity-40" />
            <p className="text-dark-muted font-black uppercase tracking-widest text-sm">Sin notificaciones</p>
          </div>
        ) : (
          <AnimatePresence>
            {(notifications as any[]).map((n: any, i: number) => {
              const config = TYPE_CONFIG[n.tipo] || TYPE_CONFIG.info;
              const Icon = config.icon;
              return (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={`flex items-start gap-4 p-5 rounded-2xl border transition-all ${
                    !n.leida ? `${config.bg} border` : 'bg-dark-card border-dark-border opacity-60'
                  }`}
                >
                  <div className={`p-2 rounded-xl ${!n.leida ? config.bg : 'bg-dark-bg/50'} shrink-0`}>
                    <Icon size={18} className={config.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${!n.leida ? 'text-dark-text' : 'text-dark-muted'}`}>
                      {n.mensaje || n.titulo}
                    </p>
                    <p className="text-xs text-dark-muted mt-1">{n.tipo} · {n.creado_en ? new Date(n.creado_en).toLocaleString('es-CO') : ''}</p>
                  </div>
                  {!n.leida && (
                    <button
                      onClick={() => markReadMutation.mutate(n.id)}
                      className="p-1.5 rounded-xl text-dark-muted hover:text-emerald-400 hover:bg-emerald-500/10 transition-all shrink-0"
                      title="Marcar como leída"
                    >
                      <CheckCircle2 size={16} />
                    </button>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};
