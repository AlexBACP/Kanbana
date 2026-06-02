/**
 * MiContextoCard — Tarjeta visible en el dashboard del aprendiz/líder técnico.
 *
 * Muestra de forma compacta y prominente:
 *   - Ficha + jornada + programa
 *   - Instructor (avatar + nombre)
 *   - Proyecto formativo + estado
 *   - Sprint/módulo activo + progreso
 *   - Líder técnico del proyecto
 *
 * Sirve para que un aprendiz vea "dónde estoy" en el sistema con un vistazo.
 */
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  GraduationCap, FolderKanban, BookMarked, ShieldCheck,
  Mail, Calendar, ChevronRight, Loader2, AlertCircle, Layers,
} from 'lucide-react';
import { userService } from '../services/user.service';

const JORNADA_META: Record<string, { label: string; emoji: string; color: string }> = {
  mañana: { label: 'Mañana', emoji: '🌅', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  tarde:  { label: 'Tarde',  emoji: '☀️', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  noche:  { label: 'Noche',  emoji: '🌙', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
};

function fmt(d: string | undefined | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

const ESTADO_COLOR: Record<string, string> = {
  activo:     'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  pausado:    'text-amber-400 bg-amber-500/10 border-amber-500/25',
  finalizado: 'text-zinc-500 bg-zinc-700/30 border-zinc-700/50',
};

export const MiContextoCard = () => {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['my-dashboard-context'],
    queryFn:  userService.getMyDashboardContext,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-zinc-600" />
      </div>
    );
  }

  if (!data?.ficha && !data?.proyecto) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-[14px] font-black text-zinc-200 mb-1">Sin contexto asignado</p>
            <p className="text-[12px] text-zinc-500">
              Aún no estás vinculado a una ficha ni a un proyecto. Espera a que tu instructor te asigne.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { ficha, proyecto, sprintActivo, esLider } = data ?? {};
  const jornada = ficha?.jornada ? JORNADA_META[ficha.jornada] : null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden shadow-md shadow-black/20">

      {/* Header */}
      <div className="px-5 py-3 border-b border-zinc-800 bg-zinc-800/30 flex items-center justify-between gap-3">
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.18em] flex items-center gap-1.5">
          <Layers size={11} /> Mi contexto en el sistema
        </p>
        {esLider && (
          <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded uppercase tracking-widest flex items-center gap-1">
            <ShieldCheck size={9} /> Líder técnico
          </span>
        )}
      </div>

      {/* Grid 2 columnas: Ficha+Instructor | Proyecto+Sprint */}
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-zinc-800">

        {/* ── Columna 1: Ficha + Instructor ────────────────────────────── */}
        <div className="p-5 space-y-4">
          {/* Ficha */}
          {ficha ? (
            <div>
              <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.15em] mb-1.5 flex items-center gap-1">
                <GraduationCap size={9} /> Ficha
              </p>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-md bg-blue-500/15 border border-blue-500/25 flex items-center justify-center shrink-0">
                  <GraduationCap size={16} className="text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="text-[15px] font-black text-white">#{ficha.codigo}</p>
                    {jornada && (
                      <span className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-widest ${jornada.color}`}>
                        <span>{jornada.emoji}</span>{jornada.label}
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-zinc-400 leading-snug">{ficha.programa}</p>
                  <p className="text-[10px] text-zinc-600 mt-1 flex items-center gap-1">
                    <Calendar size={9} /> {fmt(ficha.fecha_inicio)} → {fmt(ficha.fecha_fin)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[12px] text-zinc-600 italic">Sin ficha asignada</p>
          )}

          {/* Instructor */}
          {ficha?.instructor && (
            <div className="pt-3 border-t border-zinc-800/60">
              <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.15em] mb-1.5">Instructor</p>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-amber-500/15 border border-amber-500/25 flex items-center justify-center overflow-hidden shrink-0">
                  {userService.getAvatarUrl(ficha.instructor.avatar_url)
                    ? <img src={userService.getAvatarUrl(ficha.instructor.avatar_url)!} alt="" className="w-full h-full object-cover" />
                    : <span className="text-[10px] font-bold text-amber-300">{ficha.instructor.nombre?.slice(0, 2).toUpperCase()}</span>}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-zinc-200 truncate">{ficha.instructor.nombre}</p>
                  <p className="text-[10px] text-zinc-500 truncate flex items-center gap-1">
                    <Mail size={9} /> {ficha.instructor.correo}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Columna 2: Proyecto + Módulo activo + Líder ─────────────── */}
        <div className="p-5 space-y-4">
          {/* Proyecto */}
          {proyecto ? (
            <div>
              <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.15em] mb-1.5 flex items-center gap-1">
                <FolderKanban size={9} /> Proyecto
              </p>
              <button
                onClick={() => navigate(`/projects/${proyecto.id}/kanban`)}
                className="w-full text-left group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-md bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0">
                    <FolderKanban size={16} className="text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-[15px] font-black text-white truncate group-hover:text-violet-300 transition-colors">{proyecto.nombre}</p>
                      {proyecto.estado && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-widest ${ESTADO_COLOR[proyecto.estado] ?? ESTADO_COLOR.activo}`}>
                          {proyecto.estado}
                        </span>
                      )}
                    </div>
                    {proyecto.descripcion && (
                      <p className="text-[11px] text-zinc-500 line-clamp-2 leading-snug">{proyecto.descripcion}</p>
                    )}
                    <p className="text-[10px] text-zinc-600 mt-1 flex items-center gap-1">
                      <Calendar size={9} /> {fmt(proyecto.fecha_inicio)} → {fmt(proyecto.fecha_fin)}
                      <span className="ml-1 text-zinc-700">· {proyecto.miembrosCount} miembros</span>
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-zinc-700 shrink-0 mt-1 group-hover:text-violet-400 transition-colors" />
                </div>
              </button>
            </div>
          ) : (
            <p className="text-[12px] text-zinc-600 italic">Sin proyecto asignado</p>
          )}

          {/* Sprint / Módulo activo */}
          {sprintActivo && (
            <div className="pt-3 border-t border-zinc-800/60">
              <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.15em] mb-1.5 flex items-center gap-1">
                <BookMarked size={9} /> Módulo activo
              </p>
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-md bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                  <BookMarked size={12} className="text-emerald-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-black text-emerald-300 truncate">{sprintActivo.nombre}</p>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-0.5 flex items-center gap-1">
                    <Calendar size={9} /> {fmt(sprintActivo.fecha_inicio)} → {fmt(sprintActivo.fecha_fin)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Líder técnico */}
          {proyecto?.lider && !esLider && (
            <div className="pt-3 border-t border-zinc-800/60">
              <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.15em] mb-1.5">Líder técnico</p>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center overflow-hidden shrink-0">
                  {userService.getAvatarUrl(proyecto.lider.avatar_url)
                    ? <img src={userService.getAvatarUrl(proyecto.lider.avatar_url)!} alt="" className="w-full h-full object-cover" />
                    : <span className="text-[10px] font-bold text-emerald-300">{proyecto.lider.nombre?.slice(0, 2).toUpperCase()}</span>}
                </div>
                <p className="text-[13px] font-bold text-zinc-200 truncate">{proyecto.lider.nombre}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
