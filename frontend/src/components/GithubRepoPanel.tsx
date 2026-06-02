/**
 * GithubRepoPanel — gestión de repositorios GitHub de un proyecto.
 *
 * Eslabón central de la cadena:
 *   conectar cuenta (Settings) → VINCULAR REPO (aquí) → webhook → tickets se
 *   mueven solos → actividad visible en cada ticket.
 *
 * Muestra:
 *   - Repos vinculados (con desvincular)
 *   - Botón "Vincular repositorio" → modal con los repos del usuario en GitHub
 *   - Métricas DevOps del proyecto (commits, PRs, actividad por desarrollador)
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Github, GitCommit, GitPullRequest, Plus, X, ExternalLink,
  Lock, Loader2, BarChart3,
} from 'lucide-react';
import { githubService } from '../services/github.service';
import { Modal } from './Modal';

export const GithubRepoPanel = ({
  proyectoId,
  canManage,
}: {
  proyectoId: number;
  canManage: boolean;
}) => {
  const qc = useQueryClient();
  const [showLink, setShowLink] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const { data: status } = useQuery({
    queryKey: ['github-status'],
    queryFn:  githubService.getStatus,
  });

  const { data: repos = [] } = useQuery({
    queryKey: ['github-project-repos', proyectoId],
    queryFn:  () => githubService.getProjectRepos(proyectoId),
    enabled:  !!proyectoId,
  });

  const { data: metrics } = useQuery({
    queryKey: ['github-metrics', proyectoId],
    queryFn:  () => githubService.getProjectMetrics(proyectoId),
    enabled:  !!proyectoId && repos.length > 0,
  });

  const conectado = !!status?.conectado;

  // Lista de repos del usuario en GitHub (solo al abrir el modal)
  const { data: userRepos = [], isLoading: loadingUserRepos } = useQuery({
    queryKey: ['github-user-repos'],
    queryFn:  githubService.listUserRepos,
    enabled:  showLink && conectado,
  });

  const linkMut = useMutation({
    mutationFn: (fullName: string) => githubService.linkRepo(proyectoId, fullName),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['github-project-repos', proyectoId] });
      qc.invalidateQueries({ queryKey: ['github-metrics', proyectoId] });
      setShowLink(false);
      if (res?.aviso) setAviso(res.aviso);
    },
    onError: (e: any) => alert(e?.response?.data?.message ?? 'No se pudo vincular el repositorio'),
  });

  const unlinkMut = useMutation({
    mutationFn: (repoId: number) => githubService.unlinkRepo(repoId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['github-project-repos', proyectoId] });
      qc.invalidateQueries({ queryKey: ['github-metrics', proyectoId] });
    },
  });

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
      {/* Cabecera */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Github size={15} className="text-zinc-400" />
          <h3 className="text-sm font-black text-zinc-200 uppercase tracking-widest">Repositorios GitHub</h3>
          <span className="text-[10px] font-black text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded-full">{repos.length}</span>
        </div>
        {canManage && (
          <button
            onClick={() => { setAviso(null); setShowLink(true); }}
            disabled={!conectado}
            title={conectado ? 'Vincular un repositorio' : 'Conecta tu cuenta de GitHub en Configuración primero'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black rounded-lg border text-blue-400 border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={13} /> Vincular repositorio
          </button>
        )}
      </div>

      {!conectado && canManage && (
        <p className="text-xs text-zinc-500 bg-zinc-800/40 rounded-lg px-3 py-2 border border-zinc-700/40">
          Conecta tu cuenta de GitHub en <span className="text-zinc-300 font-bold">Configuración → Integraciones</span> para poder vincular repositorios.
        </p>
      )}

      {aviso && (
        <p className="text-xs text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2 border border-amber-500/20">{aviso}</p>
      )}

      {/* Lista de repos vinculados */}
      {repos.length === 0 ? (
        <p className="text-xs text-zinc-600 py-2">No hay repositorios vinculados a este proyecto.</p>
      ) : (
        <div className="space-y-2">
          {repos.map((r: any) => (
            <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50 group">
              <Github size={15} className="text-zinc-400 shrink-0" />
              <a href={r.html_url} target="_blank" rel="noopener noreferrer"
                className="flex-1 min-w-0 flex items-center gap-1.5 text-sm font-bold text-zinc-200 hover:text-blue-300 transition-colors truncate">
                {r.full_name}
                {r.privado && <Lock size={11} className="text-zinc-500 shrink-0" />}
                <ExternalLink size={11} className="text-zinc-600 shrink-0" />
              </a>
              {r.webhook_id
                ? <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 shrink-0">Webhook ✓</span>
                : <span className="text-[9px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20 shrink-0" title="Configura el webhook manualmente en GitHub">Sin webhook</span>}
              {canManage && (
                <button
                  onClick={() => window.confirm(`¿Desvincular ${r.full_name}?`) && unlinkMut.mutate(r.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-zinc-600 hover:text-rose-400 transition-all shrink-0"
                  title="Desvincular"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Métricas */}
      {metrics && repos.length > 0 && (
        <div className="pt-3 border-t border-zinc-800 space-y-3">
          <div className="flex items-center gap-1.5">
            <BarChart3 size={12} className="text-zinc-500" />
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Métricas DevOps</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Stat icon={<GitCommit size={13} />} label="Commits" value={metrics.commits} />
            <Stat icon={<GitPullRequest size={13} />} label="PRs mergeados" value={metrics.pull_requests?.mergeados ?? 0} />
            <Stat icon={<GitPullRequest size={13} />} label="PRs abiertos" value={metrics.pull_requests?.abiertos ?? 0} />
          </div>
          {(metrics.por_autor?.length ?? 0) > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">Actividad por desarrollador</p>
              {metrics.por_autor.slice(0, 5).map((a: any) => (
                <div key={a.autor} className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400 truncate">{a.autor}</span>
                  <span className="text-zinc-300 font-bold shrink-0 ml-2">{a.commits} commit(s)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: elegir repo del usuario */}
      <Modal isOpen={showLink} onClose={() => setShowLink(false)} title="Vincular repositorio de GitHub">
        <div className="space-y-3">
          {loadingUserRepos ? (
            <div className="flex items-center justify-center py-10 text-zinc-500">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : userRepos.length === 0 ? (
            <p className="text-sm text-zinc-500 py-6 text-center">No se encontraron repositorios en tu cuenta de GitHub.</p>
          ) : (
            <div className="max-h-[420px] overflow-y-auto space-y-1.5 pr-1">
              {userRepos.map((r: any) => {
                const yaVinculado = repos.some((x: any) => x.full_name === r.full_name);
                return (
                  <button
                    key={r.github_id}
                    onClick={() => !yaVinculado && linkMut.mutate(r.full_name)}
                    disabled={yaVinculado || linkMut.isPending}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:border-blue-500/40 transition-all text-left disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Github size={14} className="text-zinc-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-zinc-200 truncate flex items-center gap-1.5">
                        {r.full_name}
                        {r.privado && <Lock size={10} className="text-zinc-500" />}
                      </p>
                      {r.descripcion && <p className="text-[11px] text-zinc-500 truncate">{r.descripcion}</p>}
                    </div>
                    {yaVinculado
                      ? <span className="text-[9px] font-black uppercase text-emerald-400 shrink-0">Vinculado</span>
                      : linkMut.isPending
                        ? <Loader2 size={13} className="animate-spin text-zinc-500 shrink-0" />
                        : <Plus size={14} className="text-blue-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

const Stat = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) => (
  <div className="bg-zinc-800/40 rounded-lg p-2.5 border border-zinc-700/40">
    <div className="flex items-center gap-1 text-zinc-500 mb-1">{icon}</div>
    <p className="text-lg font-black text-zinc-100 leading-none">{value}</p>
    <p className="text-[9px] text-zinc-600 uppercase tracking-widest font-bold mt-1">{label}</p>
  </div>
);
