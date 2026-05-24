/**
 * TopBar — Barra superior global de Kanbana.
 *
 * Elementos:
 *   1. Título de sección (md+)
 *   2. Búsqueda global con caché de React Query + historial reciente (localStorage)
 *   3. Badge de sprint activo (líder / aprendiz)
 *   4. Botón de acción rápida "+" con menú contextual por rol
 *   5. Notificaciones con badge de no leídas
 *   6. Configuración
 *   7. Perfil con tarjeta banner + menú desplegable
 */
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Bell, Settings, LogOut, User as UserIcon,
  Search, FolderKanban, GraduationCap, CheckCircle2, X,
  ArrowRight, Plus, Zap, Layers, Clock, BookOpen,
  TicketIcon, Users, History, ChevronRight,
  Eye, AlertTriangle,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User } from '../types/user.types';
import { notificationService } from '../services/notification.service';
import { userService } from '../services/user.service';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface SearchResult {
  type: 'proyecto' | 'ficha' | 'tarea' | 'usuario';
  label: string;
  subtitle?: string;
  id: number;
  section?: string;
  path?: string;
}

interface RecentItem {
  type: SearchResult['type'];
  label: string;
  subtitle?: string;
  path?: string;
  section?: string;
  savedAt: number;
}

interface QuickAction {
  label: string;
  icon: React.ElementType;
  description: string;
  path?: string;
  section?: string;
  accent: string;
}

interface TopBarProps {
  title: string;
  user: User | null;
  onNotifications: () => void;
  onProfile: () => void;
  onSettings: () => void;
  onLogout: () => void;
  onNavigate?: (section: string) => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Constantes
// ═══════════════════════════════════════════════════════════════════════════════

// 'lider' es una clave interna de presentación, NO un rol de BD.
// El sub-rol se representa como rol='aprendiz' + es_lider_tecnico=true.
const SEARCH_PLACEHOLDER: Record<string, string> = {
  coordinador: 'Buscar fichas, proyectos, usuarios…',
  instructor:  'Buscar proyectos, aprendices, tareas…',
  lider:       'Buscar tareas, miembros del equipo…',
  aprendiz:    'Buscar mis tareas y proyectos…',
};

const TYPE_META: Record<SearchResult['type'], { icon: React.ElementType; color: string; bg: string; label: string }> = {
  proyecto: { icon: FolderKanban, color: 'text-blue-400',    bg: 'bg-blue-500/10',    label: 'Proyecto' },
  ficha:    { icon: GraduationCap, color: 'text-violet-400', bg: 'bg-violet-500/10',  label: 'Ficha'    },
  tarea:    { icon: TicketIcon,    color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Tarea'    },
  usuario:  { icon: UserIcon,      color: 'text-amber-400',  bg: 'bg-amber-500/10',   label: 'Usuario'  },
};

const QUICK_ACTIONS: Record<string, QuickAction[]> = {
  coordinador: [
    { label: 'Nueva ficha',     icon: GraduationCap, description: 'Crear una ficha de formación', section: 'fichas',    accent: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
    { label: 'Nuevo proyecto',  icon: FolderKanban,  description: 'Crear un proyecto formativo',  section: 'projects',  accent: 'text-blue-400 bg-blue-500/10 border-blue-500/20'       },
    { label: 'Ver usuarios',    icon: Users,          description: 'Gestionar usuarios del sistema', section: 'users',  accent: 'text-amber-400 bg-amber-500/10 border-amber-500/20'    },
    { label: 'Ver reportes',    icon: BookOpen,       description: 'Panel de control y estadísticas', section: 'overview', accent: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  ],
  instructor: [
    { label: 'Mis proyectos',   icon: FolderKanban,  description: 'Ver todos mis proyectos activos', section: 'projects',  accent: 'text-blue-400 bg-blue-500/10 border-blue-500/20'    },
    { label: 'Mis fichas',      icon: GraduationCap, description: 'Gestionar fichas de formación',    section: 'fichas',    accent: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
    { label: 'Mi equipo',       icon: Users,          description: 'Ver aprendices y líderes técnicos', section: 'fichas', accent: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'     },
    { label: 'Nueva tarea',     icon: Plus,           description: 'Crear ticket en un proyecto',       section: 'projects', accent: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  ],
  lider: [
    { label: 'Mi tablero',      icon: Layers,        description: 'Ir al tablero Kanban del proyecto', section: 'projects', accent: 'text-blue-400 bg-blue-500/10 border-blue-500/20'    },
    { label: 'Nueva tarea',     icon: Plus,          description: 'Crear un ticket en el sprint activo', section: 'projects', accent: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    { label: 'Mi equipo',       icon: Users,         description: 'Ver aprendices del proyecto',         section: 'equipo', accent: 'text-amber-400 bg-amber-500/10 border-amber-500/20'  },
    { label: 'Ver backlog',     icon: BookOpen,      description: 'Gestionar el backlog del proyecto',   section: 'projects', accent: 'text-zinc-300 bg-zinc-700/40 border-zinc-600/40'   },
  ],
  aprendiz: [
    { label: 'Mis tareas',      icon: CheckCircle2, description: 'Ver el estado de mis tareas',          section: 'tareas', accent: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    { label: 'Tomar tarea',     icon: Zap,          description: 'Ver pool de tareas disponibles',       section: 'tareas', accent: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'          },
    { label: 'Mi avance',       icon: Layers,       description: 'Ver progreso en el módulo activo',     section: 'overview', accent: 'text-blue-400 bg-blue-500/10 border-blue-500/20'       },
  ],
};

const RECENT_KEY = (uid: number) => `kanbana:recent:${uid}`;
const MAX_RECENT = 6;

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers de historial
// ═══════════════════════════════════════════════════════════════════════════════

function loadRecent(uid: number): RecentItem[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY(uid));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveRecent(uid: number, item: Omit<RecentItem, 'savedAt'>) {
  try {
    const all = loadRecent(uid).filter(r => r.label !== item.label || r.type !== item.type);
    const updated: RecentItem[] = [{ ...item, savedAt: Date.now() }, ...all].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY(uid), JSON.stringify(updated));
  } catch { /* ignore */ }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Componente principal
// ═══════════════════════════════════════════════════════════════════════════════

export const TopBar = ({
  title, user, onNotifications, onProfile, onSettings, onLogout, onNavigate,
}: TopBarProps) => {
  const [showMenu,     setShowMenu]     = useState(false);
  const [showActions,  setShowActions]  = useState(false);
  const [query,        setQuery]        = useState('');
  const [showSearch,   setShowSearch]   = useState(false);

  const menuRef    = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const searchRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);

  const navigate = useNavigate();
  const qc       = useQueryClient();

  // ── Rol efectivo ────────────────────────────────────────────────────────────
  const esLider    = user?.rol === 'aprendiz' && (user as any)?.es_lider_tecnico;
  // 'lider' es clave de presentación (NO rol de BD) — evita confusión con 'lider_tecnico'
  const rolEfectivo: string = esLider ? 'lider' : (user?.rol ?? 'aprendiz');

  // ── Notificaciones ──────────────────────────────────────────────────────────
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationService.getAll,
    refetchInterval: 30000,
  });
  const unread = (notifications as any[]).filter((n: any) => !n.leida).length;

  // ── Sprint activo (para líder y aprendiz) ───────────────────────────────────
  const sprintBadge = useMemo(() => {
    if (rolEfectivo !== 'lider' && rolEfectivo !== 'aprendiz') return null;
    const projects: any[] = qc.getQueryData(['projects', 'for-me']) ?? [];
    const proj = projects[0];
    if (!proj) return null;
    const sprint: any = qc.getQueryData(['projects', proj.id, 'sprint', 'active']);
    if (!sprint) return null;
    const tickets: any[] = qc.getQueryData(['tickets', proj.id]) ??
                           qc.getQueryData(['tickets', proj.id, sprint.id]) ?? [];
    const done    = tickets.filter(t => t.estado === 'done').length;
    const pct     = tickets.length > 0 ? Math.round((done / tickets.length) * 100) : 0;
    return { nombre: sprint.nombre, pct, proyectoId: proj.id };
  }, [qc, rolEfectivo]);

  // ── Contexto de actividad para el menú "+" ──────────────────────────────────
  // Se calcula a partir del caché de React Query (sin petición adicional).
  const activityContext = useMemo<{ icon: React.ElementType; text: string; color: string } | null>(() => {
    if (rolEfectivo === 'lider') {
      const projects: any[] = qc.getQueryData(['projects', 'for-me']) ?? [];
      const proj = projects[0];
      if (!proj) return null;
      const allTickets: any[] =
        qc.getQueryData(['tickets', proj.id]) ??
        qc.getQueryData(['tickets', proj.id, undefined]) ?? [];
      const testing    = allTickets.filter((t: any) => t.estado === 'testing').length;
      const inProgress = allTickets.filter((t: any) => t.estado === 'in_progress').length;
      if (testing > 0) return { icon: Eye, text: `${testing} tarea${testing > 1 ? 's' : ''} esperando revisión`, color: 'text-amber-400' };
      if (inProgress > 0) return { icon: Layers, text: `${inProgress} tarea${inProgress > 1 ? 's' : ''} en progreso`, color: 'text-blue-400' };
    }
    if (rolEfectivo === 'aprendiz') {
      const myTasks: any[] = qc.getQueryData(['mis-tareas']) ?? [];
      const blocked    = myTasks.filter((t: any) => t.esta_bloqueado).length;
      const inProgress = myTasks.filter((t: any) => t.estado === 'in_progress').length;
      if (blocked > 0) return { icon: AlertTriangle, text: `${blocked} tarea${blocked > 1 ? 's' : ''} bloqueada${blocked > 1 ? 's' : ''}`, color: 'text-rose-400' };
      if (inProgress > 0) return { icon: Layers, text: `${inProgress} tarea${inProgress > 1 ? 's' : ''} en progreso`, color: 'text-blue-400' };
    }
    return null;
  }, [qc, rolEfectivo, showActions]); // eslint-disable-line

  // ── Historial reciente ──────────────────────────────────────────────────────
  const recentItems = useMemo<RecentItem[]>(() => {
    if (!user?.id) return [];
    return loadRecent(user.id);
  }, [user?.id, showSearch]); // eslint-disable-line

  // ── Búsqueda sobre datos cacheados ──────────────────────────────────────────
  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) return [];

    const items: SearchResult[] = [];
    const rol    = user?.rol;
    const userId = user?.id;

    // Proyectos
    const projects: any[] = qc.getQueryData(['projects', 'for-me']) ?? [];
    projects
      .filter(p => p.nombre?.toLowerCase().includes(q))
      .slice(0, 4)
      .forEach(p => items.push({
        type: 'proyecto', label: p.nombre,
        subtitle: p.ficha?.codigo ? `Ficha ${p.ficha.codigo}` : undefined,
        id: p.id, path: `/projects/${p.id}/kanban`,
      }));

    // Fichas (coordinador / instructor)
    if (rol === 'coordinador' || rol === 'instructor') {
      const fichas: any[] = qc.getQueryData(['fichas']) ?? [];
      fichas
        .filter(f => f.programa?.toLowerCase().includes(q) || f.codigo?.toLowerCase().includes(q))
        .slice(0, 3)
        .forEach(f => items.push({
          type: 'ficha', label: f.programa,
          subtitle: `Ficha ${f.codigo}`, id: f.id, section: 'fichas',
        }));
    }

    // Tareas / tickets
    const ticketCache: any[] =
      qc.getQueryData(['mis-tareas']) ??
      qc.getQueryData(['tickets', 'instructor-all']) ?? [];
    const ticketPool = rol === 'aprendiz' && !esLider
      ? ticketCache.filter(t => {
          const aId = t.asignado_a_id ?? t.asignado_a?.id ?? t.asignado_a;
          return aId === userId;
        })
      : ticketCache;
    ticketPool
      .filter(t => t.titulo?.toLowerCase().includes(q))
      .slice(0, 4)
      .forEach(t => items.push({
        type: 'tarea', label: t.titulo,
        subtitle: t.proyecto?.nombre,
        id: t.id, path: `/tickets/${t.id}`,
      }));

    // Usuarios (solo coordinador)
    if (rol === 'coordinador') {
      const users: any[] = qc.getQueryData(['users']) ?? [];
      users
        .filter(u => u.nombre?.toLowerCase().includes(q) || u.correo?.toLowerCase().includes(q))
        .slice(0, 3)
        .forEach(u => items.push({
          type: 'usuario', label: u.nombre,
          subtitle: u.correo, id: u.id, section: 'users',
        }));
    }

    return items.slice(0, 9);
  }, [query, user, qc, esLider]);

  // ── Cerrar al clic fuera ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current    && !menuRef.current.contains(e.target as Node))    setShowMenu(false);
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) setShowActions(false);
      if (searchRef.current  && !searchRef.current.contains(e.target as Node))  { setShowSearch(false); setQuery(''); }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Atajos de teclado ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setShowSearch(true);
      }
      if (e.key === 'Escape') {
        setShowSearch(false);
        setShowActions(false);
        setQuery('');
        inputRef.current?.blur();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // ── Seleccionar resultado o reciente ────────────────────────────────────────
  const handleSelect = useCallback((item: { type: SearchResult['type']; label: string; subtitle?: string; path?: string; section?: string }) => {
    if (user?.id) saveRecent(user.id, item);
    setQuery('');
    setShowSearch(false);
    if (item.path)              navigate(item.path);
    else if (item.section && onNavigate) onNavigate(item.section);
  }, [user?.id, navigate, onNavigate]);

  // ── Seleccionar acción rápida ────────────────────────────────────────────────
  const handleAction = useCallback((action: QuickAction) => {
    setShowActions(false);
    if (action.path)              navigate(action.path);
    else if (action.section && onNavigate) onNavigate(action.section);
  }, [navigate, onNavigate]);

  // ── Derivados de UI ─────────────────────────────────────────────────────────
  const avatarSrc  = userService.getAvatarUrl(user?.avatar_url);
  const bannerSrc  = userService.getAvatarUrl(user?.banner_url);
  const placeholder = SEARCH_PLACEHOLDER[rolEfectivo] ?? 'Buscar…';
  const quickActions = QUICK_ACTIONS[rolEfectivo] ?? [];

  const rolLabel =
    rolEfectivo === 'coordinador'   ? 'Coordinador'    :
    rolEfectivo === 'instructor'    ? 'Instructor'     :
    rolEfectivo === 'lider_tecnico' ? 'Líder Técnico'  :
                                     'Aprendiz';

  const showDropdown = showSearch && (query.length >= 2 ? results.length > 0 : recentItems.length > 0);

  return (
    <header className="bg-zinc-900 border-b border-zinc-800 flex items-center gap-4 px-5 py-3.5 shrink-0 relative z-30">

      {/* ── Búsqueda global (ocupa el lugar del título) ──────────────────────── */}
      <div className="flex-1 max-w-2xl relative" ref={searchRef}>
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setShowSearch(true); }}
            onFocus={() => setShowSearch(true)}
            placeholder={placeholder}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-10 pr-16 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/15 transition-all"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {query ? (
              <button
                onMouseDown={e => { e.preventDefault(); setQuery(''); }}
                className="p-0.5 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <X size={13} />
              </button>
            ) : (
              <kbd className="text-[10px] font-bold text-zinc-600 bg-zinc-700/50 border border-zinc-700 rounded px-1.5 py-0.5 leading-none select-none">
                ⌘K
              </kbd>
            )}
          </div>
        </div>

        {/* ── Dropdown: historial reciente O resultados de búsqueda ───────────── */}
        <AnimatePresence>
          {showDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.12 }}
              className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-md shadow-2xl shadow-black/60 z-50 overflow-hidden"
            >
              {/* Encabezado del panel */}
              <div className="px-3 pt-2.5 pb-1 flex items-center gap-1.5">
                {query.length >= 2
                  ? <Search size={11} className="text-zinc-600" />
                  : <History size={11} className="text-zinc-600" />
                }
                <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                  {query.length >= 2 ? `${results.length} resultado${results.length !== 1 ? 's' : ''}` : 'Recientes'}
                </span>
              </div>

              <div className="divide-y divide-zinc-800/50 pb-1">
                {(query.length >= 2 ? results : recentItems.map(r => ({ ...r, id: 0 }))).map((item: any, i) => {
                  const meta = TYPE_META[item.type as SearchResult['type']];
                  const Icon = meta.icon;
                  return (
                    <button
                      key={i}
                      onMouseDown={e => { e.preventDefault(); handleSelect(item); }}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800/60 transition-colors text-left group"
                    >
                      <div className={`w-7 h-7 ${meta.bg} rounded-md flex items-center justify-center shrink-0`}>
                        <Icon size={13} className={meta.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-zinc-200 truncate">{item.label}</p>
                        {item.subtitle && (
                          <p className="text-[10px] text-zinc-500 truncate">{item.subtitle}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-widest ${meta.bg} ${meta.color} border-transparent`}>
                          {meta.label}
                        </span>
                        <ArrowRight size={11} className="text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Limpiar historial (solo cuando no hay query) */}
              {query.length < 2 && recentItems.length > 0 && (
                <div className="px-3 py-1.5 border-t border-zinc-800/50 flex justify-end">
                  <button
                    onMouseDown={e => {
                      e.preventDefault();
                      if (user?.id) localStorage.removeItem(RECENT_KEY(user.id));
                      setShowSearch(false);
                    }}
                    className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors font-medium"
                  >
                    Limpiar historial
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── 3. Badge sprint activo (líder / aprendiz) ───────────────────────── */}
      <AnimatePresence>
        {sprintBadge && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={() => onNavigate?.('projects')}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-zinc-800 border border-zinc-700 hover:border-zinc-500 rounded-md transition-colors shrink-0 group"
            title={`Sprint activo: ${sprintBadge.nombre}`}
          >
            {/* Mini ring de progreso */}
            <div className="relative w-6 h-6 shrink-0">
              <svg viewBox="0 0 24 24" className="w-full h-full -rotate-90">
                <circle cx="12" cy="12" r="9" fill="none" stroke="#3f3f46" strokeWidth="3" />
                <circle
                  cx="12" cy="12" r="9" fill="none"
                  stroke="#3b82f6" strokeWidth="3"
                  strokeDasharray={`${2 * Math.PI * 9}`}
                  strokeDashoffset={`${2 * Math.PI * 9 * (1 - sprintBadge.pct / 100)}`}
                  strokeLinecap="round"
                  className="transition-all duration-500"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[7px] font-black text-blue-400">
                {sprintBadge.pct}
              </span>
            </div>
            <div className="text-left min-w-0">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none">Sprint activo</p>
              <p className="text-[12px] font-bold text-zinc-200 truncate max-w-[110px] leading-tight mt-0.5">{sprintBadge.nombre}</p>
            </div>
            <ChevronRight size={12} className="text-zinc-600 group-hover:text-zinc-300 transition-colors shrink-0" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── 4. Botón de acción rápida "+" ────────────────────────────────────── */}
      {quickActions.length > 0 && (
        <div className="relative shrink-0" ref={actionsRef}>
          <button
            onClick={() => setShowActions(v => !v)}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all border font-black leading-none
              ${showActions
                ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20'
                : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:border-zinc-500 hover:text-white'
              }`}
            title="Acciones rápidas"
          >
            <Plus size={18} strokeWidth={2.5} />
          </button>

          <AnimatePresence>
            {showActions && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -6 }}
                transition={{ duration: 0.13 }}
                className="absolute right-0 top-full mt-1 w-64 bg-zinc-900 border border-zinc-700 rounded-md shadow-2xl shadow-black/60 z-50 overflow-hidden"
              >
                <div className="px-3 pt-2.5 pb-1 flex items-center gap-1.5">
                  <Zap size={11} className="text-zinc-600" />
                  <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Acciones rápidas</span>
                </div>

                {/* Contexto de actividad dinámico */}
                {activityContext && (
                  <div className="mx-3 mb-1.5 px-2.5 py-2 rounded-md bg-zinc-800/70 border border-zinc-700/60 flex items-center gap-2">
                    <activityContext.icon size={12} className={activityContext.color} />
                    <span className={`text-[11px] font-bold ${activityContext.color}`}>
                      {activityContext.text}
                    </span>
                  </div>
                )}

                <div className="divide-y divide-zinc-800/50 pb-1">
                  {quickActions.map((action, i) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={i}
                        onClick={() => handleAction(action)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-800/60 transition-colors text-left group"
                      >
                        <div className={`w-7 h-7 rounded-md border flex items-center justify-center shrink-0 ${action.accent}`}>
                          <Icon size={13} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-bold text-zinc-200">{action.label}</p>
                          <p className="text-[10px] text-zinc-500 truncate">{action.description}</p>
                        </div>
                        <ArrowRight size={11} className="text-zinc-700 group-hover:text-zinc-400 transition-colors shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Separador visual ──────────────────────────────────────────────────── */}
      <div className="w-px h-6 bg-zinc-700/60 shrink-0" />

      {/* ── Notificaciones ───────────────────────────────────────────────────── */}
      <button
        onClick={onNotifications}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors shrink-0"
        title="Notificaciones"
      >
        <Bell size={19} />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              key={unread}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 22 }}
              className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-rose-500 rounded-full text-[9px] font-black text-white flex items-center justify-center px-1 ring-2 ring-zinc-900 leading-none"
            >
              {unread > 9 ? '9+' : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* ── Configuración ────────────────────────────────────────────────────── */}
      <button
        onClick={onSettings}
        className="w-9 h-9 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors shrink-0"
        title="Configuración"
      >
        <Settings size={19} />
      </button>

      {/* ── Perfil (solo avatar) ──────────────────────────────────────────────── */}
      <div className="relative shrink-0" ref={menuRef}>
        <button
          onClick={() => setShowMenu(v => !v)}
          title={user?.nombre}
          className={`rounded-full transition-all ring-2 ${
            showMenu ? 'ring-blue-500/70' : 'ring-zinc-700 hover:ring-zinc-500'
          }`}
        >
          <div className="w-9 h-9 rounded-full bg-zinc-700 border-2 border-zinc-600/50 flex items-center justify-center overflow-hidden">
            {avatarSrc
              ? <img src={avatarSrc} className="w-full h-full object-cover" alt="" />
              : <span className="text-[13px] font-bold text-zinc-300">{user?.nombre?.slice(0, 2).toUpperCase()}</span>
            }
          </div>
        </button>

        <AnimatePresence>
          {showMenu && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -6 }}
              transition={{ duration: 0.13 }}
              className="absolute right-0 top-full mt-1 w-[290px] bg-zinc-900 border border-zinc-700 rounded-md shadow-2xl shadow-black/60 z-50 overflow-hidden"
            >
              {/* Tarjeta de usuario con banner */}
              <div className="mx-2 my-2 rounded-md overflow-hidden border border-zinc-800">
                <div
                  className="h-14 w-full"
                  style={bannerSrc
                    ? { backgroundImage: `url(${bannerSrc})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                    : { background: 'linear-gradient(135deg, #1c1c23 0%, #27272f 50%, #1c1c23 100%)' }
                  }
                />
                <div className="px-3 pb-3 pt-1.5 bg-zinc-950/90 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-zinc-700 shrink-0 -mt-5 ring-2 ring-zinc-900">
                    {avatarSrc
                      ? <img src={avatarSrc} className="w-full h-full object-cover" alt="" />
                      : <div className="w-full h-full bg-zinc-700 flex items-center justify-center">
                          <span className="text-[11px] font-bold text-zinc-300">{user?.nombre?.slice(0, 2).toUpperCase()}</span>
                        </div>
                    }
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-zinc-100 truncate">{user?.nombre}</p>
                    <p className="text-[11px] text-zinc-500 truncate">{user?.correo}</p>
                  </div>
                  {/* Badge de rol */}
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded border border-zinc-700 text-zinc-500 uppercase tracking-widest shrink-0">
                    {rolLabel}
                  </span>
                </div>
              </div>

              <button
                onClick={() => { onProfile(); setShowMenu(false); }}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-[13px] text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/50 transition-colors"
              >
                <UserIcon size={15} className="text-zinc-500" /> Mi perfil
              </button>
              <button
                onClick={() => { onSettings(); setShowMenu(false); }}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-[13px] text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/50 transition-colors"
              >
                <Settings size={15} className="text-zinc-500" /> Configuración
              </button>

              <div className="border-t border-zinc-800 mt-1 pt-1">
                <button
                  onClick={onLogout}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 mb-1 text-[13px] text-zinc-300 hover:text-rose-400 hover:bg-rose-500/5 transition-colors"
                >
                  <LogOut size={15} className="text-zinc-500" /> Cerrar sesión
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
};
