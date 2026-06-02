/**
 * SolicitudesPendientesPanel — vista del instructor de las solicitudes de
 * vinculación pendientes de UNA ficha. Permite aprobar o rechazar con motivo.
 *
 * Se renderiza dentro del detalle de la ficha del instructor.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserPlus, Loader2, CheckCircle2, XCircle, X,
  Calendar, Hash, Mail, Clock, AlertCircle, Inbox,
} from 'lucide-react';
import { userService } from '../services/user.service';

interface Props {
  fichaId:   number;
  fichaCode: string;
}

const JORNADA_META: Record<string, { label: string; emoji: string; color: string }> = {
  mañana: { label: 'Mañana', emoji: '🌅', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  tarde:  { label: 'Tarde',  emoji: '☀️', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  noche:  { label: 'Noche',  emoji: '🌙', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
};

export const SolicitudesPendientesPanel = ({ fichaId, fichaCode }: Props) => {
  const qc = useQueryClient();
  const [rechazando, setRechazando] = useState<{ id: number; nombre: string } | null>(null);
  const [motivo, setMotivo]         = useState('');

  const { data: solicitudes = [], isLoading } = useQuery({
    queryKey: ['solicitudes-pendientes', fichaId],
    queryFn:  () => userService.getSolicitudesPendientes(fichaId),
    enabled:  !!fichaId,
    refetchInterval: 30_000,
  });

  const aprobarMut = useMutation({
    mutationFn: (userId: number) => userService.aprobarVinculacion(userId),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['solicitudes-pendientes', fichaId] });
      qc.invalidateQueries({ queryKey: ['fichas', fichaId, 'members'] });
    },
  });

  const rechazarMut = useMutation({
    mutationFn: ({ id, motivo }: { id: number; motivo?: string }) =>
      userService.rechazarVinculacion(id, motivo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['solicitudes-pendientes', fichaId] });
      setRechazando(null);
      setMotivo('');
    },
  });

  const solicitudesArr = solicitudes as any[];

  return (
    <div className="bg-zinc-900 border border-zinc-700/60 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-700/60 bg-zinc-800/30">
        <div className="flex items-center gap-2">
          <UserPlus size={14} className="text-blue-400" />
          <h3 className="text-[13px] font-black text-zinc-100">Solicitudes pendientes</h3>
          {solicitudesArr.length > 0 && (
            <span className="text-[10px] font-black text-blue-400 bg-blue-500/15 px-2 py-0.5 rounded-full border border-blue-500/25">
              {solicitudesArr.length}
            </span>
          )}
        </div>
        <p className="text-[10px] text-zinc-500 font-bold">Ficha {fichaCode}</p>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-zinc-600" />
        </div>
      ) : solicitudesArr.length === 0 ? (
        <div className="py-10 text-center px-6">
          <Inbox size={26} className="mx-auto text-zinc-700 mb-3" />
          <p className="text-[12px] font-bold text-zinc-500">Sin solicitudes pendientes</p>
          <p className="text-[10px] text-zinc-600 mt-1 max-w-xs mx-auto leading-relaxed">
            Cuando un aprendiz se registre y solicite unirse a esta ficha,
            aparecerá aquí para que lo apruebes.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-800">
          {solicitudesArr.map((s: any) => {
            const j = JORNADA_META[s.jornada_solicitada] ?? JORNADA_META.mañana;
            const fecha = s.vinculacion_solicitada_en
              ? new Date(s.vinculacion_solicitada_en).toLocaleString('es-CO', {
                  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                })
              : '—';
            return (
              <div key={s.id} className="px-5 py-4 hover:bg-zinc-800/30 transition-colors">
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-blue-500/15 border border-blue-500/25 flex items-center justify-center overflow-hidden shrink-0">
                    {userService.getAvatarUrl(s.avatar_url)
                      ? <img src={userService.getAvatarUrl(s.avatar_url)!} alt="" className="w-full h-full object-cover" />
                      : <span className="text-[11px] font-bold text-blue-300">{s.nombre?.slice(0, 2).toUpperCase()}</span>}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-black text-zinc-100 truncate">{s.nombre}</p>
                    <p className="text-[11px] text-zinc-500 flex items-center gap-1 truncate">
                      <Mail size={9} /> {s.correo}
                    </p>

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-widest ${j.color}`}>
                        <span>{j.emoji}</span>
                        {j.label}
                      </span>
                      {s.documento && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded">
                          <Hash size={9} /> {s.documento}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[10px] text-zinc-600">
                        <Clock size={9} /> {fecha}
                      </span>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => aprobarMut.mutate(s.id)}
                      disabled={aprobarMut.isPending}
                      title="Aprobar vinculación"
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/25 rounded-md text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                    >
                      <CheckCircle2 size={11} /> Aprobar
                    </button>
                    <button
                      onClick={() => setRechazando({ id: s.id, nombre: s.nombre })}
                      disabled={rechazarMut.isPending}
                      title="Rechazar solicitud"
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-600/15 border border-rose-500/30 text-rose-400 hover:bg-rose-600/25 rounded-md text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                    >
                      <XCircle size={11} /> Rechazar
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal rechazar */}
      {rechazando && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <div>
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Rechazar solicitud</p>
                <h3 className="text-[14px] font-black text-white mt-0.5">{rechazando.nombre}</h3>
              </div>
              <button onClick={() => { setRechazando(null); setMotivo(''); }} title="Cerrar" aria-label="Cerrar" className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-start gap-2 px-3 py-2 bg-amber-500/8 border border-amber-500/20 rounded-md">
                <AlertCircle size={12} className="text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-400/90 leading-relaxed">
                  El aprendiz recibirá una notificación con el motivo. Podrá volver a solicitar otra ficha.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">Motivo (opcional)</label>
                <textarea
                  value={motivo}
                  onChange={e => setMotivo(e.target.value)}
                  placeholder="Ej: La jornada no coincide / No estás en mi lista oficial / Verifica con coordinación…"
                  rows={3}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-md px-3 py-2 text-[13px] text-zinc-100 outline-none focus:border-blue-500 resize-none"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-800">
                <button onClick={() => { setRechazando(null); setMotivo(''); }} className="px-4 py-2 text-[13px] font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={() => rechazarMut.mutate({ id: rechazando.id, motivo: motivo.trim() || undefined })}
                  disabled={rechazarMut.isPending}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-[13px] font-black rounded-md transition-all flex items-center gap-2 disabled:opacity-60"
                >
                  {rechazarMut.isPending ? <><Loader2 size={13} className="animate-spin" /> Rechazando…</> : <><XCircle size={13} /> Rechazar solicitud</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
