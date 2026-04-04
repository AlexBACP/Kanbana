import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, Circle, CheckCircle2 } from 'lucide-react';
import { notificationService } from '../../services/notification.service';

export const NotificationsPanel = () => {
  const qc = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationService.getAll,
    staleTime: 30_000,
  });

  const markReadMutation = useMutation({
    mutationFn: notificationService.markAsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllMutation = useMutation({
    mutationFn: notificationService.markAllAsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const notifs = notifications as any[];
  const unread = notifs.filter(n => !n.leida).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-title">Notificaciones</h2>
          <p className="section-subtitle">{unread > 0 ? `${unread} sin leer` : 'Todo al día'}</p>
        </div>
        {unread > 0 && (
          <button
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
            className="btn-ghost flex items-center gap-2 text-xs"
          >
            <CheckCheck size={14} />
            Marcar todas como leídas
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {[1,2,3,4].map(n => <div key={n} className="h-14 bg-surface-hover rounded-lg animate-pulse" />)}
          </div>
        ) : notifs.length === 0 ? (
          <div className="p-12 text-center">
            <Bell size={28} className="mx-auto text-ink-muted mb-3 opacity-40" />
            <p className="text-sm text-ink-muted">No tienes notificaciones</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-border">
            {notifs.map((n: any) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 px-4 py-3.5 transition-colors ${
                  !n.leida ? 'bg-info-light/30' : 'hover:bg-surface-hover'
                }`}
              >
                {/* Indicador */}
                <div className="mt-0.5 shrink-0">
                  {n.leida
                    ? <CheckCircle2 size={14} className="text-ink-muted" />
                    : <Circle size={14} className="text-info fill-info" />
                  }
                </div>

                {/* Contenido */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${n.leida ? 'text-ink-secondary' : 'text-ink-primary font-medium'}`}>
                    {n.mensaje || n.titulo}
                  </p>
                  {n.creado_en && (
                    <p className="text-xs text-ink-muted mt-0.5">
                      {new Date(n.creado_en).toLocaleDateString('es-CO', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  )}
                </div>

                {/* Acción */}
                {!n.leida && (
                  <button
                    onClick={() => markReadMutation.mutate(n.id)}
                    className="btn-ghost text-xs shrink-0"
                    title="Marcar como leída"
                  >
                    <CheckCheck size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
