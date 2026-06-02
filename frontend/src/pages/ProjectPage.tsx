/**
 * ProjectPage — ruta /projects/:id
 *
 * Vista principal de un proyecto. Muestra sus trimestres como tarjetas.
 * Al hacer clic en un trimestre navega al kanban de ese trimestre.
 *
 * El instructor puede configurar/generar trimestres desde aquí.
 * El líder técnico y aprendices ven los trimestres en modo lectura.
 */
import { useState, useEffect }                   from 'react';
import { useParams, useNavigate }                 from 'react-router-dom';
import { useQuery, useMutation, useQueryClient }  from '@tanstack/react-query';
import { useForm, useFieldArray }                 from 'react-hook-form';
import {
  ChevronLeft, Plus, BookOpen, Code2, CheckCircle2,
  Calendar, Layers, Lock, KanbanSquare, Settings,
  AlertTriangle,
} from 'lucide-react';
import { projectService } from '../services/project.service';
import { useAuthStore }   from '../store/auth.store';
import type { Trimestre } from '../types/trimestre.types';
import type { Project }   from '../types/project.types';
import { Modal }          from '../components/Modal';
import { Button }         from '../components/Button';
import { GithubRepoPanel } from '../components/GithubRepoPanel';


const FormField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{label}</label>
    {children}
  </div>
);

function fmt(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function pct(sprints: any[] = []) {
  const tickets = sprints.flatMap(s => s.tickets ?? []);
  if (!tickets.length) return 0;
  return Math.round(tickets.filter((t: any) => t.estado === 'done').length / tickets.length * 100);
}

export const ProjectPage = () => {
  const { id }      = useParams<{ id: string }>();
  const proyectoId  = Number(id);
  const navigate    = useNavigate();
  const qc          = useQueryClient();
  const { user }    = useAuthStore();

  const isAdmin = user?.rol === 'coordinador' || user?.rol === 'instructor';
  const [showGenerate, setShowGenerate] = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: project } = useQuery<Project>({
    queryKey: ['projects', proyectoId],
    queryFn:  () => projectService.getById(proyectoId),
    enabled:  !!proyectoId,
  });

  const { data: trimestres = [], isLoading } = useQuery<Trimestre[]>({
    queryKey: ['trimestres', proyectoId],
    queryFn:  () => projectService.getTrimestres(proyectoId),
    enabled:  !!proyectoId,
  });

  const { data: sinTrimestre = [] } = useQuery<any[]>({
    queryKey: ['sprints-sin-trimestre', proyectoId],
    queryFn:  () => projectService.getSprintsSinTrimestre(proyectoId),
    enabled:  !!proyectoId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['trimestres', proyectoId] });
    qc.invalidateQueries({ queryKey: ['sprints-sin-trimestre', proyectoId] });
  };

  // ── Form de generar trimestres ─────────────────────────────────────────────
  const { register: regGen, handleSubmit: hGen, control, watch, setValue } = useForm({
    defaultValues: { num: 3, trimestres: [] as any[] },
  });
  const { fields, replace } = useFieldArray({ control, name: 'trimestres' });
  const numT = watch('num');

  useEffect(() => {
    if (showGenerate && project?.fecha_inicio) {
      const start = new Date(project.fecha_inicio);
      replace(
        Array.from({ length: numT }, (_, i) => {
          const s = new Date(start);
          s.setMonth(s.getMonth() + i * 3);
          const e = new Date(s);
          e.setMonth(e.getMonth() + 3);
          e.setDate(e.getDate() - 1);
          return {
            nombre:       `Trimestre ${i + 1}`,
            fecha_inicio: s.toISOString().slice(0, 10),
            fecha_fin:    e.toISOString().slice(0, 10),
            tipo:         i === 0 ? 'documental' : 'desarrollo',
          };
        })
      );
    }
  }, [numT, project, showGenerate]);

  // ── Mutation: generar trimestres ──────────────────────────────────────────
  const generateMut = useMutation({
    mutationFn: (dto: { num: number; trimestres: any[] }) =>
      projectService.generateTrimestres(proyectoId, dto),
    onSuccess: async (creados: any[]) => {
      // Asignar módulos huérfanos al primer trimestre
      const primero = creados?.[0];
      if (primero && sinTrimestre.length > 0) {
        for (const sp of sinTrimestre) {
          try { await projectService.assignSprintToTrimestre(sp.id, primero.id); } catch { /* ok */ }
        }
      }
      invalidate();
      setShowGenerate(false);
    },
    onError: (e: any) => alert(e?.response?.data?.message ?? 'Error al generar trimestres'),
  });

  // ── Módulos: total existente y generación desde plantilla ─────────────────
  const totalSprints = trimestres.reduce((acc, t) => acc + (t.sprints?.length ?? 0), 0) + sinTrimestre.length;
  const sinModulos    = trimestres.length > 0 && totalSprints === 0;

  const generarModulosMut = useMutation({
    mutationFn: () => projectService.generarModulos(proyectoId, false),
    onSuccess: (res: any) => {
      invalidate();
      if (res?.omitido) alert(res.motivo ?? 'No se generaron módulos.');
    },
    onError: (e: any) => alert(e?.response?.data?.message ?? 'No se pudieron generar los módulos'),
  });

  // ── Colores por tipo ──────────────────────────────────────────────────────
  const colorTrim = (t: Trimestre) => {
    if (t.esta_finalizado)       return 'border-zinc-700/50 bg-zinc-800/30 opacity-70';
    if (t.tipo === 'documental') return 'border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50';
    return 'border-primary-500/30 bg-primary-500/5 hover:border-primary-500/50';
  };

  const badgeTrim = (t: Trimestre) => {
    if (t.esta_finalizado)       return 'bg-zinc-800 text-zinc-500 border-zinc-700';
    if (t.tipo === 'documental') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    return 'bg-primary-500/10 text-primary-400 border-primary-500/20';
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-y-auto">

      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-zinc-800 bg-zinc-900 shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 transition-all"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-black text-zinc-100 truncate">
            {project?.nombre ?? 'Cargando...'}
          </h1>
          <p className="text-xs text-zinc-500">
            {project?.ficha?.codigo} · {fmt(project?.fecha_inicio ?? '')} → {fmt(project?.fecha_fin ?? '')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Cola de trabajo */}
          <button
            onClick={() => navigate(`/projects/${proyectoId}/backlog`)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-700 text-xs font-bold text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-all"
          >
            <Layers size={14} /> Cola de trabajo
          </button>
          {/* Tablero completo del proyecto */}
          <button
            onClick={() => navigate(`/projects/${proyectoId}/kanban`)}
            title="Abrir el tablero completo del proyecto"
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-700 text-xs font-bold text-zinc-400 hover:text-zinc-200 hover:border-primary-500/40 transition-all"
          >
            <KanbanSquare size={14} /> Tablero
          </button>
          {isAdmin && sinModulos && (
            <button
              onClick={() => generarModulosMut.mutate()}
              disabled={generarModulosMut.isPending}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-xs font-bold text-white transition-all disabled:opacity-50"
            >
              <Plus size={14} />
              {generarModulosMut.isPending ? 'Generando...' : 'Generar módulos'}
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setShowGenerate(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-400 hover:text-primary-400 hover:border-primary-500/40 transition-all"
            >
              <Settings size={14} />
              {trimestres.length > 0 ? 'Reconfigurar' : 'Configurar trimestres'}
            </button>
          )}
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 p-6 bg-zinc-950 space-y-6">

        {/* Repositorios GitHub del proyecto — gestiona admin o el líder de ESTE proyecto */}
        <GithubRepoPanel
          proyectoId={proyectoId}
          canManage={isAdmin || (user?.rol === 'aprendiz' && (user as any)?.es_lider_tecnico === true && (project as any)?.liderId === user?.id)}
        />

        {/* Aviso: proyecto sin módulos (creado antes de la auto-generación) */}
        {sinModulos && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-primary-500/8 border border-primary-500/20">
            <AlertTriangle size={18} className="text-primary-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-zinc-200">Este proyecto no tiene módulos todavía</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Genera los módulos automáticamente desde la plantilla SDLC de la ficha ({trimestres.length} trimestres).
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={() => generarModulosMut.mutate()}
                disabled={generarModulosMut.isPending}
                className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-xs font-bold text-white transition-all disabled:opacity-50"
              >
                <Plus size={14} />
                {generarModulosMut.isPending ? 'Generando...' : 'Generar módulos'}
              </button>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(n => (
              <div key={n} className="h-48 bg-zinc-800/40 rounded-2xl animate-pulse border border-zinc-700/50" />
            ))}
          </div>
        ) : trimestres.length === 0 ? (
          /* Sin trimestres */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-2xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center mb-6">
              <Layers size={36} className="text-primary-400" />
            </div>
            <h3 className="text-xl font-black text-zinc-100 mb-2">Sin trimestres configurados</h3>
            <p className="text-sm text-zinc-500 max-w-sm mb-8 leading-relaxed">
              {isAdmin
                ? 'Configura los trimestres del proyecto para organizar los módulos y tareas.'
                : 'El instructor debe configurar los trimestres de este proyecto.'}
            </p>
            {isAdmin && (
              <Button onClick={() => setShowGenerate(true)} className="flex items-center gap-2 px-8 py-4">
                <Plus size={16} /> Configurar trimestres
              </Button>
            )}
          </div>
        ) : (
          /* Grid de trimestres */
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {trimestres.map((trim) => {
                const sprints  = trim.sprints ?? [];
                const progreso = pct(sprints);
                const total    = sprints.flatMap(s => (s as any).tickets ?? []).length;
                const done     = sprints.flatMap(s => (s as any).tickets ?? [])
                                        .filter((t: any) => t.estado === 'done').length;

                return (
                  <button
                    key={trim.id}
                    onClick={() => navigate(`/projects/${proyectoId}/trimestre/${trim.id}`)}
                    className={`text-left rounded-2xl border p-5 transition-all hover:scale-[1.01] hover:shadow-xl ${colorTrim(trim)}`}
                  >
                    {/* Badge tipo */}
                    <div className="flex items-center justify-between mb-4">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${badgeTrim(trim)}`}>
                        {trim.tipo === 'documental'
                          ? <><BookOpen size={10} /> Documental</>
                          : <><Code2 size={10} /> Desarrollo</>}
                      </span>
                      {trim.esta_finalizado && (
                        <CheckCircle2 size={16} className="text-zinc-500" />
                      )}
                    </div>

                    {/* Nombre */}
                    <h3 className="text-base font-black text-zinc-100 mb-1">
                      {trim.nombre || `Trimestre ${trim.numero}`}
                    </h3>

                    {/* Fechas */}
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 mb-4">
                      <Calendar size={11} />
                      {fmt(trim.fecha_inicio)} → {fmt(trim.fecha_fin)}
                    </div>

                    {/* Barra de progreso */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-zinc-500">{sprints.length} módulo(s)</span>
                        <span className={trim.tipo === 'documental' ? 'text-amber-400' : 'text-primary-400'}>
                          {done}/{total} tareas
                        </span>
                      </div>
                      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            trim.tipo === 'documental' ? 'bg-amber-400' : 'bg-primary-500'
                          }`}
                          style={{ width: `${progreso}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-zinc-500 text-right">{progreso}%</p>
                    </div>

                    {/* Footer */}
                    <div className="mt-4 pt-3 border-t border-zinc-700/40 flex items-center justify-between">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                        {trim.esta_finalizado ? 'Finalizado' : 'Ver módulos →'}
                      </span>
                      {!trim.esta_finalizado && (
                        <KanbanSquare size={14} className={trim.tipo === 'documental' ? 'text-amber-400' : 'text-primary-400'} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Módulos sin trimestre */}
            {sinTrimestre.length > 0 && isAdmin && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={14} className="text-amber-400" />
                  <span className="text-xs font-black text-amber-400 uppercase tracking-widest">
                    {sinTrimestre.length} módulo(s) sin trimestre asignado
                  </span>
                </div>
                <p className="text-xs text-zinc-500">
                  Estos módulos no están vinculados a ningún trimestre. Puedes reorganizarlos desde el tablero completo.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal configurar trimestres */}
      <Modal
        isOpen={showGenerate}
        onClose={() => setShowGenerate(false)}
        title="Configurar trimestres"
        size="lg"
      >
        <form onSubmit={hGen(data => generateMut.mutate(data))} className="space-y-5">
          {trimestres.length > 0 && (
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-400">
                Ya existen trimestres. Si reconfiguras, los anteriores serán eliminados
                (solo si no tienen módulos finalizados) y los módulos huérfanos se
                asignarán automáticamente al primer trimestre nuevo.
              </p>
            </div>
          )}

          <FormField label={`Número de trimestres — ${numT}`}>
            <div className="flex items-center gap-3">
              <input
                type="range" min={3} max={10} step={1}
                {...regGen('num', { valueAsNumber: true })}
                className="flex-1 accent-primary-500"
              />
              <span className="text-2xl font-black text-primary-400 w-8 text-center">{numT}</span>
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">
              Cada trimestre dura 3 meses desde la fecha de inicio del proyecto.
            </p>
          </FormField>

          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {fields.map((field, i) => (
              <div key={field.id} className="bg-zinc-800/40 border border-zinc-700/50 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-primary-400 uppercase tracking-widest">
                    Trimestre {i + 1}
                  </span>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border ${
                    i === 0
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      : 'bg-primary-500/10 text-primary-400 border-primary-500/20'
                  }`}>
                    {i === 0 ? 'Documental' : 'Desarrollo'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Fecha inicio">
                    <input
                      type="date"
                      {...regGen(`trimestres.${i}.fecha_inicio` as const)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-200 outline-none focus:border-primary-500"
                    />
                  </FormField>
                  <FormField label="Fecha fin">
                    <input
                      type="date"
                      {...regGen(`trimestres.${i}.fecha_fin` as const)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-200 outline-none focus:border-primary-500"
                    />
                  </FormField>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowGenerate(false)}>Cancelar</Button>
            <Button type="submit" isLoading={generateMut.isPending} className="px-8">
              Generar {numT} trimestres
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};