/**
 * SearchModal — Búsqueda global Cmd+K / Ctrl+K
 *
 * Busca en tiempo real sobre:
 *   - Tickets (título, descripción)
 *   - Proyectos (nombre)
 *
 * Uso: montar en App.tsx o en el layout principal.
 * Se activa con Cmd+K / Ctrl+K, y se cierra con Escape o clic fuera.
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate }                           from 'react-router-dom';
import { useQuery }                              from '@tanstack/react-query';
import { motion, AnimatePresence }               from 'framer-motion';
import {
  Search, X, Ticket, FolderKanban, ArrowRight,
  Loader2, AlertCircle, Hash, Clock,
} from 'lucide-react';
import { ticketService }   from '../services/ticket.service';
import { projectService }  from '../services/project.service';

// ── Tipos locales ─────────────────────────────────────────────────────────────
interface SearchResult {
  id:    number;
  kind:  'ticket' | 'project';
  label: string;
  sub?:  string;
  to:    string;
  meta?: string;
}

const STATUS_LABEL: Record<string, string> = {
  to_do:       'Por hacer',
  in_progress: 'En desarrollo',
  testing:     'En revisión',
  done:        'Finalizado',
};

// ── SearchModal ───────────────────────────────────────────────────────────────
interface Props {
  open:    boolean;
  onClose: () => void;
}

export const SearchModal = ({ open, onClose }: Props) => {
  const navigate = useNavigate();
  const [query, setQuery]           = useState('');
  const [activeIdx, setActiveIdx]   = useState(0);
  const inputRef  = useRef<HTMLInputElement>(null);
  const listRef   = useRef<HTMLDivElement>(null);

  // ── Pre-fetch datos (solo cuando está abierto) ─────────────────────────────
  const { data: allTickets = [], isFetching: ticketsFetching } = useQuery({
    queryKey: ['search', 'tickets'],
    queryFn:  () => ticketService.getAll(),
    enabled:  open,
    staleTime: 30_000,
  });

  const { data: allProjects = [], isFetching: projectsFetching } = useQuery({
    queryKey: ['search', 'projects'],
    queryFn:  () => projectService.getForMe(),
    enabled:  open,
    staleTime: 60_000,
  });

  const isFetching = ticketsFetching || projectsFetching;

  // ── Resultados filtrados ───────────────────────────────────────────────────
  const results = useMemo((): SearchResult[] => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const tickets: SearchResult[] = (allTickets as any[])
      .filter(t =>
        t.titulo?.toLowerCase().includes(q) ||
        t.descripcion?.toLowerCase().includes(q)
      )
      .slice(0, 6)
      .map(t => ({
        id:    t.id,
        kind:  'ticket' as const,
        label: t.titulo,
        sub:   t.proyecto?.nombre ?? (t.proyecto_id ? `Proyecto #${t.proyecto_id}` : undefined),
        to:    `/tickets/${t.id}`,
        meta:  STATUS_LABEL[t.estado] ?? t.estado,
      }));

    const projects: SearchResult[] = (allProjects as any[])
      .filter(p => p.nombre?.toLowerCase().includes(q))
      .slice(0, 3)
      .map(p => ({
        id:    p.id,
        kind:  'project' as const,
        label: p.nombre,
        sub:   p.ficha?.codigo ?? undefined,
        to:    `/projects/${p.id}/kanban`,
        meta:  p.estado,
      }));

    return [...tickets, ...projects];
  }, [query, allTickets, allProjects]);

  // ── Resetear estado al abrir ───────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setActiveIdx(0);
  }, [results.length]);

  // ── Scroll al ítem activo ──────────────────────────────────────────────────
  useEffect(() => {
    const el = listRef.current?.children[activeIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  // ── Teclado ────────────────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[activeIdx]) selectResult(results[activeIdx]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const selectResult = (r: SearchResult) => {
    navigate(r.to);
    onClose();
  };

  // ── Render ─────────────────────────────────────────────────────────────────
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
            className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-xl z-[101] px-4"
          >
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">

              {/* Buscador */}
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-zinc-800">
                {isFetching
                  ? <Loader2 size={16} className="text-zinc-500 shrink-0 animate-spin" />
                  : <Search size={16} className="text-zinc-500 shrink-0" />
                }
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Buscar tareas, proyectos..."
                  className="flex-1 bg-transparent text-zinc-100 text-sm outline-none placeholder:text-zinc-600"
                />
                {query && (
                  <button onClick={() => setQuery('')} className="text-zinc-600 hover:text-zinc-300 transition-colors shrink-0">
                    <X size={14} />
                  </button>
                )}
                <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-600 text-[10px] font-mono shrink-0">
                  esc
                </kbd>
              </div>

              {/* Resultados */}
              <div className="max-h-80 overflow-y-auto custom-scrollbar" ref={listRef}>
                {!query ? (
                  <div className="px-4 py-6 text-center text-zinc-600 text-xs space-y-1">
                    <Search size={20} className="mx-auto mb-2 opacity-30" />
                    <p>Escribe para buscar tareas y proyectos</p>
                    <p className="text-zinc-700 text-[10px]">↑↓ navegar · Enter seleccionar · Esc cerrar</p>
                  </div>
                ) : results.length === 0 ? (
                  <div className="px-4 py-6 text-center text-zinc-600 text-xs">
                    <AlertCircle size={20} className="mx-auto mb-2 opacity-30" />
                    No se encontraron resultados para «{query}»
                  </div>
                ) : (
                  <div className="py-2">
                    {/* Agrupar por tipo */}
                    {['ticket', 'project'].map(kind => {
                      const group = results.filter(r => r.kind === kind);
                      if (!group.length) return null;
                      return (
                        <div key={kind}>
                          <div className="px-4 py-1.5 flex items-center gap-2">
                            {kind === 'ticket'
                              ? <Ticket size={10} className="text-zinc-600" />
                              : <FolderKanban size={10} className="text-zinc-600" />
                            }
                            <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">
                              {kind === 'ticket' ? 'Tareas' : 'Proyectos'}
                            </span>
                          </div>
                          {group.map(r => {
                            const idx = results.indexOf(r);
                            const isActive = idx === activeIdx;
                            return (
                              <button
                                key={`${r.kind}-${r.id}`}
                                onClick={() => selectResult(r)}
                                onMouseEnter={() => setActiveIdx(idx)}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                  isActive ? 'bg-zinc-800' : 'hover:bg-zinc-800/60'
                                }`}
                              >
                                {/* Icono */}
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                  r.kind === 'ticket'
                                    ? 'bg-blue-500/10 border border-blue-500/20'
                                    : 'bg-cyan-500/10 border border-cyan-500/20'
                                }`}>
                                  {r.kind === 'ticket'
                                    ? <Hash size={13} className="text-blue-400" />
                                    : <FolderKanban size={13} className="text-cyan-400" />
                                  }
                                </div>

                                {/* Texto */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-zinc-200 truncate">{r.label}</p>
                                  {r.sub && (
                                    <p className="text-[10px] text-zinc-600 truncate">{r.sub}</p>
                                  )}
                                </div>

                                {/* Meta */}
                                {r.meta && (
                                  <span className="text-[10px] text-zinc-500 shrink-0 hidden sm:block">{r.meta}</span>
                                )}

                                <ArrowRight size={12} className={`shrink-0 transition-all ${isActive ? 'text-zinc-400' : 'text-zinc-700'}`} />
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
                  <span className="flex items-center gap-1"><kbd className="font-mono bg-zinc-800 px-1 py-0.5 rounded border border-zinc-700">↑↓</kbd> navegar</span>
                  <span className="flex items-center gap-1"><kbd className="font-mono bg-zinc-800 px-1 py-0.5 rounded border border-zinc-700">↵</kbd> abrir</span>
                </div>
                {results.length > 0 && (
                  <span className="text-[10px] text-zinc-600">{results.length} resultado{results.length !== 1 ? 's' : ''}</span>
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
