/**
 * GitHubWidget — Rediseñado
 *
 * Widget visual completo para un repositorio GitHub.
 * - Header siempre visible con repo name, language, visibilidad
 * - Stats en grid 4 columnas con números grandes
 * - Commits animados con framer-motion stagger
 * - PRs abiertos con avatar del autor
 * - Token config integrada limpiamente
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Github, GitBranch, GitPullRequest, Star, GitFork,
  AlertCircle, Loader2, RefreshCw, ChevronDown, ChevronUp,
  Lock, Globe, Clock, ExternalLink, Key, Check, GitCommit,
} from 'lucide-react';
import { recursoService } from '../services/recurso.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)   return 'ahora mismo';
  if (mins < 60)  return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7)   return `hace ${days}d`;
  return new Date(dateStr).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

// ─── Token config form ────────────────────────────────────────────────────────

const TokenForm = ({
  proyectoId, recursoId, onSaved, onCancel,
}: {
  proyectoId: number; recursoId: number; onSaved: () => void; onCancel: () => void;
}) => {
  const [token, setToken]   = useState('');
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  const handleSave = async () => {
    if (!token.trim()) return;
    setSaving(true);
    try {
      await recursoService.saveToken(proyectoId, recursoId, token.trim());
      setSaved(true);
      setToken('');
      setTimeout(() => { setSaved(false); onSaved(); }, 1200);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="px-5 pb-4 space-y-3">
        <div className="p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl">
          <p className="text-[11px] text-amber-400 font-bold flex items-center gap-1.5">
            <Key size={11} /> Token de acceso (repositorio privado)
          </p>
          <p className="text-[10px] text-zinc-500 mt-1">
            El token se guarda cifrado. Solo necesitas acceso de lectura (repo:read).
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="password"
            value={token}
            onChange={e => setToken(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="ghp_xxxxxxxxxxxxxxxx"
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-[12px] text-zinc-200 outline-none focus:border-blue-500/50 placeholder:text-zinc-600 transition-colors"
          />
          <button
            onClick={handleSave}
            disabled={!token.trim() || saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-[12px] font-black rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            {saved ? <><Check size={13} /> Guardado</> : saving ? <Loader2 size={13} className="animate-spin" /> : 'Guardar'}
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[12px] rounded-xl transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

interface GitHubWidgetProps {
  recursoId: number;
  proyectoId: number;
  canManage?: boolean;
  defaultExpanded?: boolean;
}

export const GitHubWidget = ({
  recursoId, proyectoId, canManage = false, defaultExpanded = false,
}: GitHubWidgetProps) => {
  const [expanded,      setExpanded]      = useState(defaultExpanded);
  const [showTokenForm, setShowTokenForm] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['github', proyectoId, recursoId],
    queryFn:  () => recursoService.getGitHubData(proyectoId, recursoId),
    enabled:  expanded,
    staleTime: 2 * 60_000,
    retry: 0,
  });

  const gh = data as any;
  const errMsg: string =
    (error as any)?.response?.data?.message ||
    'No se pudo conectar. El repositorio puede ser privado o la URL es incorrecta.';

  const STATS = gh ? [
    { icon: Star,        value: gh.estrellas,      label: 'Stars',   color: 'text-amber-400',   bg: 'bg-amber-500/8' },
    { icon: GitFork,     value: gh.forks,           label: 'Forks',   color: 'text-blue-400',    bg: 'bg-blue-500/8'  },
    { icon: AlertCircle, value: gh.issues_abiertos, label: 'Issues',  color: 'text-rose-400',    bg: 'bg-rose-500/8'  },
    { icon: GitBranch,   value: gh.rama_default,    label: 'Rama',    color: 'text-emerald-400', bg: 'bg-emerald-500/8' },
  ] : [];

  return (
    <div className="rounded-2xl border border-zinc-700/60 overflow-hidden shadow-xl shadow-black/30 bg-zinc-900">

      {/* ── Header — siempre visible ─────────────────────────────────────── */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full text-left"
      >
        <div className="relative px-5 py-4 bg-gradient-to-r from-zinc-900 via-zinc-800/80 to-zinc-900 hover:via-zinc-800/50 transition-all">
          {/* Glow line top */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-zinc-600/50 to-transparent" />

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {/* GitHub icon con fondo */}
              <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700/70 flex items-center justify-center shrink-0 shadow-md">
                {(isLoading || isFetching) && expanded
                  ? <Loader2 size={16} className="text-zinc-400 animate-spin" />
                  : <Github size={16} className="text-zinc-300" />
                }
              </div>

              <div className="min-w-0">
                {gh ? (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      <a
                        href={gh.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-[14px] font-black text-zinc-100 hover:text-blue-400 transition-colors flex items-center gap-1"
                      >
                        {gh.nombre} <ExternalLink size={11} className="opacity-60" />
                      </a>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wide flex items-center gap-1 ${
                        gh.privado
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}>
                        {gh.privado ? <><Lock size={9} /> Privado</> : <><Globe size={9} /> Público</>}
                      </span>
                      {gh.lenguaje && (
                        <span className="text-[10px] px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded-full text-zinc-400 font-bold">
                          {gh.lenguaje}
                        </span>
                      )}
                    </div>
                    {gh.descripcion && (
                      <p className="text-[11.5px] text-zinc-500 mt-0.5 line-clamp-1">{gh.descripcion}</p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-[13px] font-black text-zinc-300">GitHub Live</p>
                    <p className="text-[11px] text-zinc-600">
                      {expanded ? 'Cargando repositorio…' : 'Haz clic para ver actividad del repo'}
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Toggle chevron */}
            <div className="shrink-0 w-7 h-7 rounded-lg bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center">
              {expanded
                ? <ChevronUp size={14} className="text-zinc-400" />
                : <ChevronDown size={14} className="text-zinc-400" />
              }
            </div>
          </div>
        </div>
      </button>

      {/* ── Expanded content ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden border-t border-zinc-800/80"
          >
            {/* Loading skeleton */}
            {isLoading && !data && (
              <div className="px-5 py-6 space-y-3">
                <div className="grid grid-cols-4 gap-2">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="h-14 bg-zinc-800/50 rounded-xl animate-pulse" />
                  ))}
                </div>
                {[1,2,3].map(i => (
                  <div key={i} className="h-8 bg-zinc-800/30 rounded-lg animate-pulse" style={{ opacity: 1 - i * 0.25 }} />
                ))}
              </div>
            )}

            {/* Error state */}
            {isError && !data && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="px-5 py-5 space-y-3"
              >
                <div className="flex items-start gap-3 p-4 bg-rose-500/8 border border-rose-500/20 rounded-xl">
                  <AlertCircle size={15} className="text-rose-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[12.5px] font-bold text-rose-300">Error de conexión</p>
                    <p className="text-[11px] text-rose-400/70 mt-0.5 leading-relaxed">{errMsg}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => refetch()}
                    className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[12px] font-bold rounded-xl transition-colors"
                  >
                    <RefreshCw size={12} /> Reintentar
                  </button>
                  <button
                    onClick={() => setShowTokenForm(v => !v)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-amber-500/10 hover:bg-amber-500/15 text-amber-400 text-[12px] font-bold rounded-xl border border-amber-500/20 transition-colors"
                  >
                    <Key size={12} /> Token privado
                  </button>
                </div>

                <AnimatePresence>
                  {showTokenForm && (
                    <TokenForm
                      proyectoId={proyectoId}
                      recursoId={recursoId}
                      onSaved={() => {
                        setShowTokenForm(false);
                        qc.invalidateQueries({ queryKey: ['github', proyectoId, recursoId] });
                        refetch();
                      }}
                      onCancel={() => setShowTokenForm(false)}
                    />
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* Data */}
            {gh && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                {/* Stats grid */}
                <div className="grid grid-cols-4 border-b border-zinc-800/70">
                  {STATS.map((s, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.2 }}
                      className={`flex flex-col items-center gap-1.5 py-4 ${i < 3 ? 'border-r border-zinc-800/70' : ''} ${s.bg}`}
                    >
                      <s.icon size={15} className={s.color} />
                      <span className={`text-[15px] font-black ${s.color}`}>{s.value}</span>
                      <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">{s.label}</span>
                    </motion.div>
                  ))}
                </div>

                {/* Commits */}
                {gh.commits?.length > 0 && (
                  <div className="border-b border-zinc-800/70">
                    <div className="flex items-center justify-between px-5 py-3">
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                        <GitCommit size={11} /> Últimos commits
                      </span>
                      <button
                        onClick={() => refetch()}
                        disabled={isFetching}
                        className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-600 hover:text-zinc-300 transition-all disabled:opacity-40"
                        title="Actualizar"
                      >
                        <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
                      </button>
                    </div>
                    <div className="px-3 pb-3 space-y-0.5">
                      {gh.commits.map((c: any, i: number) => (
                        <motion.a
                          key={i}
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.07, duration: 0.2 }}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-zinc-800/50 transition-colors group"
                        >
                          <code className="text-[11px] font-black text-cyan-400 font-mono shrink-0 bg-zinc-800 px-2 py-0.5 rounded-lg border border-zinc-700/60 min-w-[52px] text-center">
                            {c.sha}
                          </code>
                          <span className="text-[12.5px] text-zinc-300 group-hover:text-zinc-100 transition-colors flex-1 line-clamp-1 leading-tight">
                            {c.mensaje}
                          </span>
                          <span className="text-[10.5px] text-zinc-600 shrink-0 whitespace-nowrap tabular-nums">
                            {timeAgo(c.fecha)}
                          </span>
                        </motion.a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Open PRs */}
                {gh.prs_abiertos?.length > 0 && (
                  <div className="border-b border-zinc-800/70">
                    <div className="px-5 py-3">
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                        <GitPullRequest size={11} className="text-emerald-500" />
                        Pull Requests ({gh.prs_abiertos.length})
                      </span>
                    </div>
                    <div className="px-3 pb-3 space-y-0.5">
                      {gh.prs_abiertos.map((pr: any, i: number) => (
                        <motion.a
                          key={pr.numero}
                          href={pr.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.07, duration: 0.2 }}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-zinc-800/50 transition-colors group"
                        >
                          <GitPullRequest size={13} className="text-emerald-400 shrink-0" />
                          <span className="text-[12.5px] text-zinc-300 group-hover:text-zinc-100 transition-colors flex-1 line-clamp-1">
                            <span className="text-zinc-600 font-bold mr-1">#{pr.numero}</span>
                            {pr.titulo}
                          </span>
                          {pr.avatar && (
                            <img
                              src={pr.avatar}
                              alt={pr.autor}
                              title={pr.autor}
                              className="w-6 h-6 rounded-full border border-zinc-700 shrink-0"
                            />
                          )}
                        </motion.a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-3">
                  {gh.actualizado_en && (
                    <p className="text-[11px] text-zinc-600 flex items-center gap-1.5">
                      <Clock size={11} /> Actualizado {timeAgo(gh.actualizado_en)}
                    </p>
                  )}
                  {canManage && (
                    <button
                      onClick={() => setShowTokenForm(v => !v)}
                      className="flex items-center gap-1.5 text-[11px] text-zinc-600 hover:text-amber-400 transition-colors font-medium"
                    >
                      <Key size={11} /> {showTokenForm ? 'Cancelar token' : 'Token privado'}
                    </button>
                  )}
                </div>

                <AnimatePresence>
                  {showTokenForm && canManage && (
                    <TokenForm
                      proyectoId={proyectoId}
                      recursoId={recursoId}
                      onSaved={() => {
                        setShowTokenForm(false);
                        qc.invalidateQueries({ queryKey: ['github', proyectoId, recursoId] });
                        refetch();
                      }}
                      onCancel={() => setShowTokenForm(false)}
                    />
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
