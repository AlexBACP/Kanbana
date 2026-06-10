/**
 * SearchModal — Búsqueda global Cmd+K / Ctrl+K
 *
 * Usa el endpoint GET /search que ya filtra por rol del usuario autenticado:
 *   - Coordinador : proyectos, módulos, tareas, fichas, usuarios
 *   - Instructor  : solo sus proyectos/módulos/tareas/fichas
 *   - Líder téc.  : solo proyectos/módulos/tareas del proyecto que lidera
 *   - Aprendiz    : solo sus tareas asignadas
 *
 * Navegación por tipo:
 *   proyecto / módulo  → path directo (kanban o detalle de trimestre)
 *   tarea              → /tickets/:id
 *   ficha              → /dashboard?s=fichas
 *   usuario            → /dashboard?s=users
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate }                           from 'react-router-dom';
import { useQuery }                              from '@tanstack/react-query';
import { motion, AnimatePresence }               from 'framer-motion';
import {
  Search, X, ArrowRight, Loader2, AlertCircle,
  Hash, FolderKanban, Layers, BookOpen, User2,
} from 'lucide-react';
import { searchService, SearchHit } from '../services/search.service';

// ── Configuración por tipo de resultado ──────────────────────────────────────
const TYPE_CONFIG: Record<SearchHit['type'], {
  label: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}> = {
  tarea: {
    label:     'Tareas',
    icon:      <Hash size={13} />,
    iconBg:    'bg-blue-500/10 border-blue-500/20',
    iconColor: 'text-blue-400',
  },
  proyecto: {
    label:     'Proyectos',
    icon:      <FolderKanban size={13} />,
    iconBg:    'bg-cyan-500/10 border-cyan-500/20',
    iconColor: 'text-cyan-400',
  },
  modulo: {
    label:     'Módulos',
    icon:      <Layers size={13} />,
    iconBg:    'bg-violet-500/10 border-violet-500/20',
    iconColor: 'text-violet-400',
  },
  ficha: {
    label:     'Fichas',
    icon:      <BookOpen size={13} />,
    iconBg:    'bg-emerald-500/10 border-emerald-500/20',
    iconColor: 'text-emerald-400',
  },
  usuario: {
    label:     'Usuarios',
    icon:      <User2 size={13} />,
    iconBg:    'bg-amber-500/10 border-amber-500/20',
    iconColor: 'text-amber-400',
  },
};

// Orden en que se muestran los grupos
const TYPE_ORDER: SearchHit['type'][] = ['tarea', 'proyecto', 'modulo', 'ficha', 'usuario'];

// Convierte un SearchHit en una ruta navegable
function hitToPath(hit: SearchHit, navigate: ReturnType<typeof useNavigate>) {
  if (hit.path) {
    navigate(hit.path);
  } else if (hit.section) {
    navigate(`/dashboard?s=${hit.section}`);
  }
}

// ── SearchModal ───────────────────────────────────────────────────────────────
interface Props { open: boolean; onClose: () => void; }

export const SearchModal = ({ open, onClose }: Props) => {
  const navigate                          = useNavigate();
  const [query, setQuery]                 = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeIdx, setActiveIdx]         = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLDivElement>(null);

  // ── Debounce de 280 ms ────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 280);
    return () => clearTimeout(t);
  }, [query]);

  // ── Query al backend /search (filtrado por rol, mín. 2 chars) ─────────────
  const { data: hits = [], isFetching } = useQuery<SearchHit[]>({
    queryKey:  ['global-search', debouncedQuery],
    queryFn:   () => searchService.search(debouncedQuery),
    enabled:   open && debouncedQuery.length >= 2,
    staleTime: 15_000,
  });

  // ── Agrupar resultados por tipo en el orden definido ─────────────────────
  const groups = useMemo(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) return [];
    return TYPE_ORDER
      .map(type => ({ type, items: hits.filter(h => h.type === type) }))
      .filter(g => g.items.length > 0);
  }, [hits, debouncedQuery]);

  // Lista plana para navegación con teclado
  const flatItems = useMemo(() => groups.flatMap(g => g.items), [groups]);

  // ── Reset al abrir ────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setQuery('');
      setDebouncedQuery('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => { setActiveIdx(0); }, [flatItems.length]);

  // ── Scroll al ítem activo ─────────────────────────────────────────────────
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  // ── Teclado ───────────────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatItems[activeIdx]) {
        hitToPath(flatItems[activeIdx], navigate);
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const selectHit = (hit: SearchHit) => {
    hitToPath(hit, navigate);
    onClose();
  };

  // ── Indicador de estado del spinner ──────────────────────────────────────
  // Spinner si está fetching O si el query cambió pero el debounce aún no disparó
  const isLoading = isFetching || (query.trim().length >= 2 && query.trim() !== debouncedQuery);
  const hasQuery  = query.trim().length > 0;
  const tooShort  = query.trim().length === 1;

  // índice global para resaltar el ítem activo
  let globalIdx = 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{   opacity: 0, scale: 0.96, y: -8  }}
            transition={{ duration: 0.15 }}
            className="fixed top-[13%] left-1/2 -translate-x-1/2 w-full max-w-xl z-[101] px-4"
          >
            <div className="bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">

              {/* Input */}
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-zinc-800">
                {isLoading
                  ? <Loader2 size={16} className="text-zinc-500 shrink-0 animate-spin" />
                  : <Search  size={16} className="text-zinc-500 shrink-0" />
                }
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Buscar tareas, proyectos, módulos..."
                  className="flex-1 bg-transparent text-zinc-100 text-sm outline-none placeholder:text-zinc-600"
                />
                {query && (
                  <button
                    onClick={() => { setQuery(''); setDebouncedQuery(''); }}
                    className="text-zinc-600 hover:text-zinc-300 transition-colors shrink-0"
                  >
                    <X size={14} />
                  </button>
                )}
                <kbd className="hidden sm:flex items-center px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-600 text-[10px] font-mono shrink-0">
                  esc
                </kbd>
              </div>

              {/* Resultados */}
              <div className="max-h-[360px] overflow-y-auto" ref={listRef}>

                {/* Estado vacío */}
                {!hasQuery && (
                  <div className="px-4 py-7 text-center text-zinc-600 text-xs space-y-1.5">
                    <Search size={22} className="mx-auto mb-2 opacity-25" />
                    <p className="text-zinc-500">Busca tareas, proyectos, módulos...</p>
                    <p className="text-zinc-700 text-[10px]">↑↓ navegar · Enter abrir · Esc cerrar</p>
                  </div>
                )}

                {/* Query demasiado corto */}
                {tooShort && (
                  <div className="px-4 py-5 text-center text-zinc-600 text-xs">
                    Escribe al menos 2 caracteres
                  </div>
                )}

                {/* Sin resultados */}
                {!isLoading && !tooShort && debouncedQuery.length >= 2 && groups.length === 0 && (
                  <div className="px-4 py-7 text-center text-zinc-600 text-xs">
                    <AlertCircle size={20} className="mx-auto mb-2 opacity-30" />
                    Sin resultados para «{debouncedQuery}»
                  </div>
                )}

                {/* Grupos de resultados */}
                {groups.length > 0 && (
                  <div className="py-1.5">
                    {groups.map(({ type, items }) => {
                      const cfg = TYPE_CONFIG[type];
                      return (
                        <div key={type}>
                          {/* Cabecera del grupo */}
                          <div className="px-4 py-1.5 flex items-center gap-2">
                            <span className={`text-[9px] font-black uppercase tracking-widest ${cfg.iconColor} opacity-70`}>
                              {cfg.label}
                            </span>
                          </div>

                          {/* Items del grupo */}
                          {items.map(hit => {
                            const idx      = globalIdx++;
                            const isActive = idx === activeIdx;
                            return (
                              <button
                                key={`${hit.type}-${hit.id}`}
                                data-idx={idx}
                                onClick={() => selectHit(hit)}
                                onMouseEnter={() => setActiveIdx(idx)}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                  isActive ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
                                }`}
                              >
                                {/* Icono */}
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${cfg.iconBg} ${cfg.iconColor}`}>
                                  {cfg.icon}
                                </div>

                                {/* Texto */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-[13px] font-semibold text-zinc-200 truncate leading-tight">
                                    {hit.label}
                                  </p>
                                  {hit.subtitle && (
                                    <p className="text-[10px] text-zinc-500 truncate mt-0.5">{hit.subtitle}</p>
                                  )}
                                </div>

                                {/* Meta badge */}
                                {hit.meta?.estado && (
                                  <span className="text-[10px] text-zinc-500 shrink-0 hidden sm:block truncate max-w-[80px]">
                                    {String(hit.meta.estado)}
                                  </span>
                                )}

                                <ArrowRight
                                  size={12}
                                  className={`shrink-0 transition-all ${isActive ? 'text-zinc-300' : 'text-zinc-700'}`}
                                />
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-zinc-800 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-3 text-[10px] text-zinc-600">
                  <span className="flex items-center gap-1">
                    <kbd className="font-mono bg-zinc-800 px-1 py-0.5 rounded border border-zinc-700">↑↓</kbd>
                    navegar
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="font-mono bg-zinc-800 px-1 py-0.5 rounded border border-zinc-700">↵</kbd>
                    abrir
                  </span>
                </div>
                {flatItems.length > 0 && (
                  <span className="text-[10px] text-zinc-600">
                    {flatItems.length} resultado{flatItems.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// ── Hook: activa con Cmd+K / Ctrl+K ──────────────────────────────────────────
export const useSearchModal = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(o => !o);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return { isOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) };
};
