import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FolderKanban, Clock, CheckCircle2, AlertTriangle,
  Calendar as CalendarIcon, TrendingUp, Users, Flag, Lightbulb, BarChart3,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { dashboardService } from '../../services/dashboard.service';
import { useNavigate } from 'react-router-dom';

// ── Sugerencias específicas para coordinador ─────────────────────────────────
const COORD_SUGGESTIONS = [
  'Revisa que todos los proyectos activos tengan un líder técnico asignado para este ciclo.',
  'Monitorea las fichas sin instructor — necesitan asignación antes del inicio del trimestre.',
  'El avance global refleja el esfuerzo de todas las fichas — comparte los logros con instructores.',
  'Antes del cierre del trimestre, valida que los proyectos tengan sus módulos registrados.',
  'Proyectos con avance inferior al 40% pueden necesitar apoyo adicional esta semana.',
  'Agenda una revisión con los instructores para sincronizar el estado de todas las fichas.',
  'Identifica equipos sin actividad reciente — un bloqueo no resuelto puede afectar el cierre.',
];

export const Overview = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const formattedDate = useMemo(() => {
    return new Intl.DateTimeFormat('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long',
    }).format(new Date());
  }, []);

  const suggestion = useMemo(
    () => COORD_SUGGESTIONS[new Date().getDay() % COORD_SUGGESTIONS.length], []
  );

  // Reloj en tiempo real
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );
  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Query al endpoint consolidado del dashboard ───────────────────────────
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn:  dashboardService.getStats,
    staleTime: 60_000,
  });

  // ── Helpers de estilo ─────────────────────────────────────────────────────
  const estadoBadge = (estado: string) => {
    if (estado === 'activo')  return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (estado === 'pausado') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    return 'bg-zinc-800 text-zinc-500 border-zinc-700';
  };
  const estadoLabel = (estado: string) => {
    if (estado === 'activo')  return 'Activo';
    if (estado === 'pausado') return 'En pausa';
    return 'Finalizado';
  };

  // ── 4 tarjetas de métricas principales ───────────────────────────────────
  const statCards = [
    { label: 'Proyectos activos',  value: stats?.proyectos_activos  ?? '—', icon: FolderKanban,  color: 'text-blue-400',    bg: 'bg-blue-500/10'    },
    { label: 'Tareas en progreso', value: stats?.tickets_en_progreso ?? '—', icon: Clock,         color: 'text-amber-400',   bg: 'bg-amber-500/10'   },
    { label: 'Completadas',        value: stats?.tickets_completados ?? '—', icon: CheckCircle2,  color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Bloqueadas',         value: stats?.tickets_bloqueados  ?? '—', icon: AlertTriangle, color: 'text-rose-400',    bg: 'bg-rose-500/10'    },
  ];

  return (
    <div className="space-y-6">

      {/* ── Banner ───────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden m-6 rounded-md p-8 text-white shadow-lg bg-gradient-to-br from-emerald-700 via-teal-800 to-teal-950">
        <div className="absolute top-0 right-0 w-2/5 h-full opacity-15 pointer-events-none">
          <svg viewBox="0 0 220 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <polygon points="110,18 140,36 140,72 110,90 80,72 80,36" fill="none" stroke="currentColor" strokeWidth="1.8" opacity="0.7"/>
            <polygon points="158,55 188,73 188,109 158,127 128,109 128,73" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.55"/>
            <polygon points="62,95 92,113 92,149 62,167 32,149 32,113" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5"/>
            <polygon points="55,18 85,36 85,72 55,90 25,72 25,36" fill="none" stroke="currentColor" strokeWidth="1.3" opacity="0.4"/>
            <line x1="140" y1="54" x2="158" y2="73" stroke="currentColor" strokeWidth="1.2" opacity="0.4"/>
            <line x1="80"  y1="54" x2="62"  y2="73" stroke="currentColor" strokeWidth="1.2" opacity="0.35"/>
            <line x1="110" y1="90" x2="92"  y2="113" stroke="currentColor" strokeWidth="1.2" opacity="0.4"/>
            <circle cx="110" cy="54"  r="4"   fill="currentColor" opacity="0.7"/>
            <circle cx="158" cy="91"  r="3"   fill="currentColor" opacity="0.55"/>
            <circle cx="62"  cy="131" r="3"   fill="currentColor" opacity="0.5"/>
            <circle cx="55"  cy="54"  r="2.5" fill="currentColor" opacity="0.4"/>
          </svg>
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-4 flex-wrap">
              <p className="text-sm font-medium opacity-80 flex items-center gap-2 capitalize">
                <CalendarIcon size={13} />{formattedDate}
              </p>
              <p className="text-sm font-black opacity-90 flex items-center gap-1.5 tabular-nums">
                <Clock size={13} />{time}
              </p>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              Hola, {user?.nombre?.split(' ')[0]} {user?.nombre?.split(' ')[1] || ''}
            </h1>
            <p className="text-emerald-200 font-medium text-sm">
              {stats
                ? `${stats.proyectos_activos} proyecto${stats.proyectos_activos !== 1 ? 's' : ''} activo${stats.proyectos_activos !== 1 ? 's' : ''} · avance global ${stats.avance_porcentual}%`
                : 'Resumen global del centro de formación'}
            </p>
            <div className="flex items-start gap-2 mt-3 bg-white/10 backdrop-blur-sm rounded-md px-3 py-2 max-w-sm border border-white/10">
              <Lightbulb size={13} className="text-amber-300 shrink-0 mt-0.5" />
              <p className="text-xs text-white/90 leading-relaxed">{suggestion}</p>
            </div>
          </div>
          <div className="hidden sm:flex flex-col items-center gap-1 bg-white/10 backdrop-blur-md px-5 py-3 rounded-md border border-white/20 min-w-[120px]">
            <span className="text-3xl font-black">{isLoading ? '—' : `${stats?.avance_porcentual ?? 0}%`}</span>
            <span className="text-xs font-semibold uppercase tracking-wider opacity-80">Avance global</span>
          </div>
        </div>
      </div>

      {/* ── 4 tarjetas de métricas ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mx-6">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-md p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-500">{label}</p>
              <div className={`w-7 h-7 ${bg} rounded-md flex items-center justify-center`}>
                <Icon size={13} className={color} />
              </div>
            </div>
            <p className={`text-2xl font-black ${color}`}>
              {isLoading ? '—' : value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Barra de avance global + totales ─────────────────────────────── */}
      <div className="mx-6 bg-zinc-900 border border-zinc-800 rounded-md p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={14} className="text-emerald-400" />
            <span className="text-sm font-bold text-zinc-200">Progreso total del sistema</span>
          </div>
          <span className="text-sm font-black text-emerald-400">
            {isLoading ? '—' : `${stats?.avance_porcentual ?? 0}%`}
          </span>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-700"
            style={{ width: `${stats?.avance_porcentual ?? 0}%` }}
          />
        </div>
        <div className="flex items-center gap-4 mt-2.5 text-xs text-zinc-500 flex-wrap">
          <span className="text-emerald-400 font-medium">{stats?.tickets_completados ?? 0} completadas</span>
          <span>·</span>
          <span className="text-amber-400 font-medium">{stats?.tickets_en_progreso ?? 0} en progreso</span>
          <span>·</span>
          <span className="text-rose-400 font-medium">{stats?.tickets_bloqueados ?? 0} bloqueadas</span>
          <span>·</span>
          <span>{stats?.proyectos_total ?? 0} proyectos en total</span>
        </div>
      </div>

      {/* ── Tareas por usuario + Proyectos recientes ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mx-6">

        {/* Tareas por usuario */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-emerald-400" />
              <h3 className="text-sm font-bold text-zinc-200">Tareas por aprendiz</h3>
            </div>
            <span className="text-xs text-zinc-500">
              {stats?.tickets_por_usuario?.length ?? 0} asignados
            </span>
          </div>
          <div className="divide-y divide-zinc-800/60">
            {isLoading ? (
              [1,2,3].map(i => (
                <div key={i} className="px-5 py-3 animate-pulse flex flex-col gap-2">
                  <div className="h-3 bg-zinc-800 rounded w-1/2" />
                  <div className="h-1.5 bg-zinc-800 rounded w-full" />
                </div>
              ))
            ) : !stats?.tickets_por_usuario?.length ? (
              <p className="px-5 py-8 text-sm text-zinc-600 text-center">No hay tickets asignados aún</p>
            ) : (
              stats.tickets_por_usuario.map(u => (
                <div key={u.id} className="px-5 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-[10px] font-black text-white shrink-0">
                        {u.nombre?.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-zinc-200 truncate max-w-[130px]">
                        {u.nombre.split(' ')[0]} {u.nombre.split(' ')[1] || ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-zinc-500">{u.completados}/{u.total}</span>
                      <span className="text-xs font-black text-emerald-400">{u.porcentaje}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        u.porcentaje >= 75 ? 'bg-emerald-500' :
                        u.porcentaje >= 40 ? 'bg-amber-500'   : 'bg-blue-500'
                      }`}
                      style={{ width: `${u.porcentaje}%` }}
                    />
                  </div>
                  <div className="flex gap-3 mt-1 text-[10px] text-zinc-600">
                    <span className="text-emerald-400">{u.completados} ✓</span>
                    <span className="text-blue-400">{u.en_progreso} en progreso</span>
                    <span>{u.pendientes} pendiente{u.pendientes !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Proyectos recientes con avance real */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <FolderKanban size={14} className="text-emerald-400" />
              <h3 className="text-sm font-bold text-zinc-200">Proyectos recientes</h3>
            </div>
            <span className="text-xs text-zinc-500">{stats?.proyectos_total ?? 0} en total</span>
          </div>
          <div className="divide-y divide-zinc-800/60">
            {isLoading ? (
              [1,2,3].map(i => (
                <div key={i} className="px-5 py-3 animate-pulse flex flex-col gap-2">
                  <div className="h-3 bg-zinc-800 rounded w-2/3" />
                  <div className="h-1.5 bg-zinc-800 rounded w-full" />
                </div>
              ))
            ) : !stats?.proyectos_recientes?.length ? (
              <p className="px-5 py-8 text-sm text-zinc-600 text-center">Sin proyectos aún</p>
            ) : (
              stats.proyectos_recientes.map(p => (
                <div
                  key={p.id}
                  className="px-5 py-3 hover:bg-zinc-800/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/projects/${p.id}/kanban`)}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-medium text-zinc-200 truncate flex-1 mr-2">{p.nombre}</p>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border shrink-0 ${estadoBadge(p.estado)}`}>
                      {estadoLabel(p.estado)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-500"
                      style={{ width: `${p.avance}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-0.5 text-[10px] text-zinc-600">
                    <span>{p.total_tickets} tickets</span>
                    <span className="text-emerald-400 font-bold">{p.avance}%</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* ── Distribución por prioridad ────────────────────────────────────── */}
      {!isLoading && stats?.tickets_por_prioridad?.length ? (
        <div className="mx-6 mb-6 bg-zinc-900 border border-zinc-800 rounded-md p-5">
          <div className="flex items-center gap-2 mb-4">
            <Flag size={14} className="text-emerald-400" />
            <h3 className="text-sm font-bold text-zinc-200">Tareas por prioridad</h3>
            <span className="ml-auto text-xs text-zinc-500">
              {stats.tickets_por_prioridad.reduce((s, p) => s + p.total, 0)} en total
            </span>
          </div>
          <div className="flex gap-4">
            {['alta','media','baja'].map(prioridad => {
              const item      = stats.tickets_por_prioridad.find(p => p.prioridad === prioridad);
              const totalAll  = stats.tickets_por_prioridad.reduce((s, p) => s + p.total, 0);
              const count     = item?.total ?? 0;
              const pct       = totalAll > 0 ? Math.round((count / totalAll) * 100) : 0;
              const barColor  = prioridad === 'alta' ? 'bg-rose-500' : prioridad === 'media' ? 'bg-amber-500' : 'bg-slate-500';
              const txtColor  = prioridad === 'alta' ? 'text-rose-400' : prioridad === 'media' ? 'text-amber-400' : 'text-zinc-400';
              const label     = prioridad === 'alta' ? 'Alta' : prioridad === 'media' ? 'Media' : 'Baja';
              return (
                <div key={prioridad} className="flex-1">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className={`font-bold ${txtColor}`}>{label}</span>
                    <span className="font-black text-zinc-200">{count}</span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div className={`h-full ${barColor} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] text-zinc-600 mt-0.5 text-right">{pct}%</p>
                </div>
              );
            })}
          </div>
          {/* Barra de avance visual resumida */}
          <div className="mt-4 pt-4 border-t border-zinc-800 flex items-center gap-2">
            <BarChart3 size={12} className="text-zinc-600" />
            <span className="text-xs text-zinc-600">
              {stats.tickets_completados} completadas de {(stats.tickets_completados ?? 0) + (stats.tickets_en_progreso ?? 0) + (stats.tickets_bloqueados ?? 0)} tickets registrados
            </span>
          </div>
        </div>
      ) : null}

    </div>
  );
};
