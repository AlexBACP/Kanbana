import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FolderKanban, Clock, CheckCircle2, AlertTriangle,
  Calendar as CalendarIcon, TrendingUp, Users, Flag,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
// ── CAMBIO: ya no importamos projectService ni ticketService por separado.
// Toda la data viene de una sola llamada a dashboardService.getStats()
import { dashboardService } from '../../services/dashboard.service';
import { useNavigate } from 'react-router-dom';

export const Overview = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const formattedDate = useMemo(() => {
    const date = new Date();
    return new Intl.DateTimeFormat('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(date);
  }, []);

  // ── MODIFICADO ───────────────────────────────────────────────────────────
  // Problema anterior:
  //   bannerStyles tenía una clave 'lider_tecnico', pero ese rol YA NO EXISTE
  //   (el enum de roles es solo coordinador | instructor | aprendiz; el
  //   liderazgo técnico se maneja con el campo booleano es_lider_tecnico
  //   sobre aprendices). Resultado:
  //     - La clave 'lider_tecnico' nunca se usaba (código muerto).
  //     - No había clave 'aprendiz', así que tanto el aprendiz normal como
  //       el aprendiz-líder caían siempre en el estilo 'default'.
  //
  // Solución:
  //   Calculamos un 'rolEfectivo' que SÍ distingue al aprendiz-líder
  //   (rol === 'aprendiz' && es_lider_tecnico) del aprendiz normal, y lo
  //   usamos tanto para el color del banner como para el subtítulo.
  // ─────────────────────────────────────────────────────────────────────────
  const esLider = user?.rol === 'aprendiz' && user?.es_lider_tecnico;

  // Rol efectivo: 'lider' es el aprendiz con sub-rol de líder técnico.
  const rolEfectivo: 'coordinador' | 'instructor' | 'lider' | 'aprendiz' =
    user?.rol === 'coordinador' ? 'coordinador'
    : user?.rol === 'instructor' ? 'instructor'
    : esLider ? 'lider'
    : 'aprendiz';

  const bannerStyles: Record<string, string> = {
    coordinador: 'from-emerald-500 to-teal-600',
    instructor:  'from-indigo-500 to-purple-600',
    // ── CAMBIO: la clave fantasma 'lider_tecnico' se renombró a 'lider' ──
    lider:       'from-blue-500 to-cyan-600',
    // ── CAMBIO: nueva clave 'aprendiz' (antes caía en 'default') ────────
    aprendiz:    'from-slate-700 to-slate-800',
    default:     'from-slate-700 to-slate-800',
  };
  const currentStyle = bannerStyles[rolEfectivo] ?? bannerStyles.default;

  // ── CAMBIO: una sola query al endpoint consolidado ────────────────────
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn:  dashboardService.getStats,
    staleTime: 60_000,
  });

  // ── Tarjetas de métricas usando datos reales del backend ─────────────
  const statCards = [
    {
      label: 'Proyectos activos',
      // ── CAMBIO: antes filtraba en cliente; ahora viene calculado del backend
      value: stats?.proyectos_activos ?? '—',
      icon:  FolderKanban,
      color: 'text-blue-400',
      bg:    'bg-blue-500/10',
    },
    {
      label: 'Tareas en progreso',
      // ── CAMBIO: dato real del backend, no filter() en cliente
      value: stats?.tickets_en_progreso ?? '—',
      icon:  Clock,
      color: 'text-amber-400',
      bg:    'bg-amber-500/10',
    },
    {
      label: 'Completados',
      value: stats?.tickets_completados ?? '—',
      icon:  CheckCircle2,
      color: 'text-emerald-400',
      bg:    'bg-emerald-500/10',
    },
    {
      label: 'Bloqueados',
      // ── CAMBIO: antes usaba t.bloqueado (campo incorrecto); ahora usa
      // esta_bloqueado que es el nombre real en la entidad Ticket
      value: stats?.tickets_bloqueados ?? '—',
      icon:  AlertTriangle,
      color: 'text-rose-400',
      bg:    'bg-rose-500/10',
    },
  ];

  // ── Color para el badge de estado del proyecto ───────────────────────
  const estadoBadge = (estado: string) => {
    if (estado === 'activo')    return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (estado === 'pausado')   return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    return 'bg-dark-border/40 text-dark-muted border-dark-border';
  };

  const estadoLabel = (estado: string) => {
    if (estado === 'activo')    return 'Activo';
    if (estado === 'pausado')   return 'En pausa';
    return 'Finalizado';
  };

  return (
    <div className="space-y-6 ">

      {/* ── Banner ───────────────────────────────────────────────────── */}
      <div className={`relative overflow-hidden m-6 rounded-xl p-8 text-white shadow-lg bg-gradient-to-r ${currentStyle}`}>
        <div className="absolute top-0 right-0 w-1/3 h-full opacity-15 pointer-events-none">
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full transform translate-x-10 translate-y-[-20%]">
            <path fill="currentColor" d="M44.7,-76.4C58.1,-69.2,69.2,-57.4,76.5,-43.8C83.8,-30.2,87.3,-15.1,86.5,-0.5C85.7,14.1,80.5,28.2,72.4,40.6C64.3,53,53.2,63.7,40.4,71.1C27.6,78.5,13.8,82.5,-0.5,83.4C-14.8,84.3,-29.7,82.1,-43,75.2C-56.3,68.4,-68.1,56.9,-76.2,43.4C-84.3,29.9,-88.7,14.9,-88.2,0.3C-87.7,-14.3,-82.3,-28.6,-74.1,-41.2C-65.9,-53.8,-54.9,-64.7,-42,-72.1C-29.1,-79.6,-14.5,-83.5,0.3,-84.1C15.1,-84.7,31.2,-83.6,44.7,-76.4Z" transform="translate(100 100)" />
          </svg>
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium opacity-90 flex items-center gap-2 capitalize">
              <CalendarIcon size={14} />
              {formattedDate}
            </p>
            <h1 className="text-3xl font-bold mt-2 tracking-tight">
              Hola, {user?.nombre?.split(' ')[0]} {user?.nombre?.split(' ')[1] || ''}
            </h1>
            {/* ── MODIFICADO: el subtítulo ahora usa rolEfectivo ───────────
                Antes: cualquiera que no fuera coordinador ni instructor veía
                "Progreso de tu equipo de desarrollo" — incluido el aprendiz
                normal, que NO tiene equipo. Ese texto es propio del líder. */}
            <p className="text-indigo-100 mt-1 font-medium">
              {rolEfectivo === 'coordinador' ? 'Resumen global del centro de formación' :
               rolEfectivo === 'instructor'  ? 'Estado de tus fichas y proyectos' :
               rolEfectivo === 'lider'       ? 'Progreso de tu equipo de desarrollo' :
               'Tus tareas y avance en el proyecto'}
            </p>
          </div>
          {/* ── CAMBIO: badge muestra avance real con porcentaje del backend */}
          <div className="hidden sm:flex flex-col items-center gap-1 bg-white/10 backdrop-blur-md px-5 py-3 rounded-xl border border-white/20 min-w-[120px]">
            <span className="text-3xl font-black">
              {isLoading ? '—' : `${stats?.avance_porcentual ?? 0}%`}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider opacity-80">Avance global</span>
          </div>
        </div>
      </div>

      {/* ── Tarjetas de métricas ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mx-14">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-[#1f1f21] border border-white rounded-xl  p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-dark-muted">{label}</p>
              <div className={`w-7 h-7 ${bg} rounded-lg flex items-center justify-center`}>
                <Icon size={14} className={color} />
              </div>
            </div>
            <p className="text-2xl font-semibold text-dark-text">
              {isLoading ? '—' : value}
            </p>
          </div>
        ))}
      </div>

      {/* ── NUEVO: Barra de avance global ───────────────────────────── */}
      {!isLoading && stats && (
        <div className="bg-dark-card mx-14 border border-dark-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-primary-400" />
              <span className="text-sm font-medium text-dark-text">Progreso total del sistema</span>
            </div>
            <span className="text-sm font-black text-primary-400">{stats.avance_porcentual}%</span>
          </div>
          <div className="h-2 bg-dark-bg rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary-600 to-primary-400 rounded-full transition-all duration-700"
              style={{ width: `${stats.avance_porcentual}%` }}
            />
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-dark-muted">
            <span>{stats.tickets_completados} completados</span>
            <span>·</span>
            <span>{stats.tickets_abiertos} abiertos</span>
            <span>·</span>
            <span>{stats.proyectos_total} proyectos</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 mx-14 gap-4">

        {/* ── NUEVO: Tarea por usuario (requerimiento del dashboard) ── */}
        <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-primary-400" />
              <h3 className="text-sm font-medium text-dark-text">Tarea por usuario</h3>
            </div>
            <span className="text-xs text-dark-muted">
              {stats?.tickets_por_usuario?.length ?? 0} asignados
            </span>
          </div>
          <div className="divide-y divide-dark-border">
            {isLoading ? (
              // ── Skeleton de carga
              [1, 2, 3].map(i => (
                <div key={i} className="px-4 py-3 animate-pulse">
                  <div className="h-3 bg-dark-border rounded w-1/2 mb-2" />
                  <div className="h-1.5 bg-dark-border rounded w-full" />
                </div>
              ))
            ) : !stats?.tickets_por_usuario?.length ? (
              <p className="px-4 py-8 text-sm text-dark-muted text-center">
                No hay tickets asignados aún
              </p>
            ) : (
              stats.tickets_por_usuario.map(u => (
                <div key={u.id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      {/* ── Avatar con inicial del nombre */}
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-600 to-indigo-700 flex items-center justify-center text-[10px] font-black text-white shrink-0">
                        {u.nombre?.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-dark-text truncate max-w-[130px]">
                        {u.nombre.split(' ')[0]} {u.nombre.split(' ')[1] || ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-dark-muted">{u.completados}/{u.total}</span>
                      {/* ── CAMBIO: porcentaje calculado en backend, no en cliente */}
                      <span className="text-xs font-black text-primary-400">{u.porcentaje}%</span>
                    </div>
                  </div>
                  {/* ── Barra de progreso por usuario */}
                  <div className="h-1.5 bg-dark-bg rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        u.porcentaje >= 75 ? 'bg-emerald-500' :
                        u.porcentaje >= 40 ? 'bg-amber-500' : 'bg-primary-500'
                      }`}
                      style={{ width: `${u.porcentaje}%` }}
                    />
                  </div>
                  <div className="flex gap-3 mt-1 text-[10px] text-dark-muted">
                    <span className="text-emerald-400">{u.completados} ✓</span>
                    <span className="text-blue-400">{u.en_progreso} ⟳</span>
                    <span>{u.pendientes} pendiente{u.pendientes !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Proyectos recientes con avance real ─────────────────────── */}
        <div className="bg-dark-card border border-dark-border rounded-xl  overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border">
            <div className="flex items-center gap-2">
              <FolderKanban size={14} className="text-primary-400" />
              <h3 className="text-sm font-medium text-dark-text">Proyectos recientes</h3>
            </div>
            <span className="text-xs text-dark-muted">{stats?.proyectos_total ?? 0} total</span>
          </div>
          <div className="divide-y divide-dark-border">
            {isLoading ? (
              [1, 2, 3].map(i => (
                <div key={i} className="px-4 py-3 animate-pulse">
                  <div className="h-3 bg-dark-border rounded w-2/3 mb-2" />
                  <div className="h-1.5 bg-dark-border rounded w-full" />
                </div>
              ))
            ) : !stats?.proyectos_recientes?.length ? (
              <p className="px-4 py-8 text-sm text-dark-muted text-center">Sin proyectos aún</p>
            ) : (
              stats.proyectos_recientes.map(p => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-dark-border/20 transition-colors cursor-pointer"
                  onClick={() => navigate(`/projects/${p.id}/kanban`)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-dark-text truncate">{p.nombre}</p>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ml-2 shrink-0 ${estadoBadge(p.estado)}`}>
                        {estadoLabel(p.estado)}
                      </span>
                    </div>
                    {/* ── CAMBIO: barra de avance real por proyecto (done/total tickets) */}
                    <div className="h-1.5 bg-dark-bg rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary-600 to-primary-400 rounded-full transition-all duration-500"
                        style={{ width: `${p.avance}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-0.5 text-[10px] text-dark-muted">
                      <span>{p.total_tickets} tickets</span>
                      <span className="text-primary-400 font-bold">{p.avance}%</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* ── NUEVO: Distribución por prioridad ───────────────────────── */}
      {!isLoading && stats && stats.tickets_por_prioridad && stats.tickets_por_prioridad.length > 0 && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-4 mx-14 mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Flag size={14} className="text-primary-400" />
            <h3 className="text-sm font-medium text-dark-text">Tareas por prioridad</h3>
          </div>
          <div className="flex gap-4">
            {['alta', 'media', 'baja'].map(prioridad => {
              const item = stats.tickets_por_prioridad.find(p => p.prioridad === prioridad);
              const total_todos = stats.tickets_por_prioridad.reduce((s, p) => s + p.total, 0);
              const count = item?.total ?? 0;
              const pct   = total_todos > 0 ? Math.round((count / total_todos) * 100) : 0;
              const colors: Record<string, string> = {
                alta:  'bg-rose-500',
                media: 'bg-amber-500',
                baja:  'bg-slate-500',
              };
              const labels: Record<string, string> = {
                alta:  'Alta',
                media: 'Media',
                baja:  'Baja',
              };
              return (
                <div key={prioridad} className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-dark-muted">{labels[prioridad]}</span>
                    <span className="font-black text-dark-text">{count}</span>
                  </div>
                  <div className="h-2 bg-dark-bg rounded-full overflow-hidden">
                    <div
                      className={`h-full ${colors[prioridad]} rounded-full transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-dark-muted mt-0.5 text-right">{pct}%</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};