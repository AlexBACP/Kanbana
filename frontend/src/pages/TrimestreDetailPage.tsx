/**
 * TrimestreDetailPage — ruta /projects/:id/trimestre/:trimestreId
 *
 * Página de detalle de un trimestre. Muestra:
 *   - Info del trimestre (nombre, fechas, tipo)
 *   - Lista de módulos (sprints) del trimestre
 *   - Mini-aside desplegable con aprendices + instructor del proyecto
 *   - Botón "Tablero" → abre el kanban en nueva pestaña
 *
 * Permisos de edición:
 *   - Instructor: puede editar nombre y fechas del trimestre, crear módulos
 *   - Líder técnico: puede solicitar edición/creación (permisos temporales — próximamente)
 *   - Aprendiz/resto: solo lectura
 */
import { useState }                              from 'react';
import { useParams, useNavigate }                from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, BookOpen, Code2, Calendar, Users,
  Plus, KanbanSquare, CheckCircle2, Clock, Lock,
  ChevronRight, X, ExternalLink, AlertTriangle,
  Pencil, Check,
} from 'lucide-react';
import { projectService } from '../services/project.service';
import { useAuthStore }   from '../store/auth.store';
import { Trimestre }      from '../types/trimestre.types';
import { Modal }          from '../components/Modal';
import { Button }         from '../components/Button';
import { permisosService } from '../services/permisos.service';

const FormField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black text-dark-muted uppercase tracking-widest">{label}</label>
    {children}
  </div>
);

function fmt(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export const TrimestreDetailPage = () => {
  const { id, trimestreId } = useParams<{ id: string; trimestreId: string }>();
  const proyectoId  = Number(id);
  const trimId      = Number(trimestreId);
  const navigate    = useNavigate();
  const qc          = useQueryClient();
  const { user }    = useAuthStore();

  const isInstructor  = user?.rol === 'coordinador' || user?.rol === 'instructor';
  const esLider       = user?.rol === 'aprendiz' && (user as any)?.es_lider_tecnico;
  const canEdit       = isInstructor; // permisos temporales del líder: próximamente

  const [asideOpen,      setAsideOpen]      = useState(false);
  const [showModModal,   setShowModModal]    = useState(false);
  const [editingNombre,  setEditingNombre]   = useState(false);
  const [nombreDraft,    setNombreDraft]     = useState('');
  const [editingFechas,  setEditingFechas]   = useState(false);
  const [fechasDraft,    setFechasDraft]     = useState({ inicio: '', fin: '' });

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: project } = useQuery({
    queryKey: ['projects', proyectoId],
    queryFn:  () => projectService.getById(proyectoId),
    enabled:  !!proyectoId,
  });

  const { data: trimestres = [] } = useQuery<Trimestre[]>({
    queryKey: ['trimestres', proyectoId],
    queryFn:  () => projectService.getTrimestres(proyectoId),
    enabled:  !!proyectoId,
  });

  const trim = (trimestres as Trimestre[]).find(t => t.id === trimId);

  const { data: members = [] } = useQuery({
    queryKey: ['projects', proyectoId, 'members'],
    queryFn:  () => projectService.getMembers(proyectoId),
    enabled:  !!proyectoId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['trimestres', proyectoId] });
    qc.invalidateQueries({ queryKey: ['projects', proyectoId] });
  };

  // ── Mutations ──────────────────────────────────────────────────────────────
  const editTrimMut = useMutation({
    mutationFn: (dto: any) => projectService.updateTrimestre(trimId, dto),
    onSuccess:  () => { invalidate(); setEditingNombre(false); setEditingFechas(false); },
    onError:    (e: any) => alert(e?.response?.data?.message ?? 'Error al actualizar'),
  });

  const createModMut = useMutation({
    mutationFn: (dto: any) => projectService.createSprintEnTrimestre(proyectoId, trimId, dto),
    onSuccess:  () => { invalidate(); setShowModModal(false); },
    onError:    (e: any) => alert(e?.response?.data?.message ?? 'Error al crear módulo'),
  });

  const closeModMut = useMutation({
    mutationFn: (sprintId: number) => projectService.closeSprint(sprintId),
    onSuccess:  invalidate,
    onError:    (e: any) => alert(e?.response?.data?.message ?? 'No se pudo cerrar el módulo'),
  });

  const closeTrimMut = useMutation({
    mutationFn: () => projectService.closeTrimestre(trimId),
    onSuccess:  invalidate,
    onError:    (e: any) => alert(e?.response?.data?.message ?? 'No se pudo cerrar el trimestre'),
  });

  // ── Derivados ──────────────────────────────────────────────────────────────
  const modulos    = trim?.sprints ?? [];
  const aprendices = (members as any[]).filter((m: any) => m.rol === 'aprendiz');
  const instructor = (members as any[]).find((m: any) => m.rol === 'instructor')
                     ?? { nombre: project?.instructor?.nombre ?? 'Sin instructor', correo: '' };

  const allDone    = modulos.length > 0 && modulos.every((m: any) => m.esta_finalizado);
  const isDoc      = trim?.tipo === 'documental';

  // ── Handlers de edición inline ─────────────────────────────────────────────
  const startEditNombre = () => {
    setNombreDraft(trim?.nombre ?? '');
    setEditingNombre(true);
  };

  const saveNombre = () => {
    if (!nombreDraft.trim()) return;
    editTrimMut.mutate({ nombre: nombreDraft });
  };

  const startEditFechas = () => {
    setFechasDraft({
      inicio: trim?.fecha_inicio?.toString().slice(0, 10) ?? '',
      fin:    trim?.fecha_fin?.toString().slice(0, 10) ?? '',
    });
    setEditingFechas(true);
  };

  const saveFechas = () => {
    editTrimMut.mutate({
      fecha_inicio: fechasDraft.inicio,
      fecha_fin:    fechasDraft.fin,
    });
  };

  const handleSolicitarPermiso = async (tipo: 'editar_trimestre' | 'crear_modulo') => {
    const instructorId = (project as any)?.instructor?.id ?? (project as any)?.instructorId;
    if (!instructorId) {
      alert('Este proyecto no tiene instructor asignado.');
      return;
    }
    const justificacion = prompt('Justificación (opcional):') ?? undefined;
    try {
      await permisosService.solicitar({
        proyectoId:   proyectoId,
        instructorId: instructorId,
        tipo:         tipo as any,
        justificacion,
      });
      alert('Solicitud enviada. El instructor recibirá una notificación.');
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Error al enviar la solicitud.');
    }
  };

  const abrirTablero = () => {
    window.open(`/projects/${proyectoId}/trimestre/${trimId}/kanban`, '_blank');
  };

  if (!trim) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-dark-muted text-sm">Cargando trimestre...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Contenido principal ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-dark-border bg-dark-card shrink-0">
          <button
            onClick={() => navigate(`/projects/${proyectoId}`)}
            className="p-2 rounded-xl hover:bg-dark-bg/60 text-dark-muted hover:text-dark-text transition-all"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="flex-1 min-w-0">
            {/* Nombre editable inline */}
            {editingNombre ? (
              <div className="flex items-center gap-2">
                <input
                  value={nombreDraft}
                  onChange={e => setNombreDraft(e.target.value)}
                  className="bg-dark-bg border border-primary-500/50 rounded-xl px-3 py-1.5 text-sm font-black text-dark-text outline-none"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') saveNombre(); if (e.key === 'Escape') setEditingNombre(false); }}
                />
                <button onClick={saveNombre} className="p-1.5 rounded-lg bg-primary-500/20 text-primary-400 hover:bg-primary-500/30 transition-all">
                  <Check size={14} />
                </button>
                <button onClick={() => setEditingNombre(false)} className="p-1.5 rounded-lg text-dark-muted hover:text-dark-text transition-all">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black text-dark-text truncate">
                  {trim.nombre || `Trimestre ${trim.numero}`}
                </h1>
                {canEdit && (
                  <button onClick={startEditNombre} className="p-1 rounded-lg text-dark-muted/40 hover:text-primary-400 transition-all">
                    <Pencil size={12} />
                  </button>
                )}
              </div>
            )}
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border flex items-center gap-1 ${
                isDoc
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-primary-500/10 text-primary-400 border-primary-500/20'
              }`}>
                {isDoc ? <><BookOpen size={9} /> Documental</> : <><Code2 size={9} /> Desarrollo</>}
              </span>
              {trim.esta_finalizado && (
                <span className="text-[10px] font-black uppercase text-dark-muted flex items-center gap-1">
                  <CheckCircle2 size={10} /> Finalizado
                </span>
              )}
            </div>
          </div>

          {/* Acciones del header */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Botón equipo */}
            <button
              onClick={() => setAsideOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dark-border text-xs font-bold text-dark-muted hover:text-dark-text hover:border-primary-500/40 transition-all"
            >
              <Users size={14} /> Equipo
            </button>

            {/* Botón tablero — abre nueva pestaña */}
            <button
              onClick={abrirTablero}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold transition-all shadow-md shadow-primary-500/20"
            >
              <KanbanSquare size={14} /> Tablero
              <ExternalLink size={11} className="opacity-70" />
            </button>
          </div>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Fechas */}
          <div className={`rounded-2xl border p-4 ${isDoc ? 'border-amber-500/20 bg-amber-500/5' : 'border-primary-500/20 bg-primary-500/5'}`}>
            {editingFechas ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Fecha inicio">
                    <input
                      type="date"
                      value={fechasDraft.inicio}
                      onChange={e => setFechasDraft(f => ({ ...f, inicio: e.target.value }))}
                      className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2 text-xs text-dark-text outline-none focus:border-primary-500"
                    />
                  </FormField>
                  <FormField label="Fecha fin">
                    <input
                      type="date"
                      value={fechasDraft.fin}
                      onChange={e => setFechasDraft(f => ({ ...f, fin: e.target.value }))}
                      className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2 text-xs text-dark-text outline-none focus:border-primary-500"
                    />
                  </FormField>
                </div>
                <div className="flex gap-2">
                  <Button onClick={saveFechas} isLoading={editTrimMut.isPending} className="px-5 py-1.5 text-xs">Guardar</Button>
                  <Button variant="secondary" onClick={() => setEditingFechas(false)} className="px-5 py-1.5 text-xs">Cancelar</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-dark-muted">
                  <Calendar size={14} />
                  <span>{fmt(trim.fecha_inicio?.toString())} → {fmt(trim.fecha_fin?.toString())}</span>
                </div>
                {canEdit && !trim.esta_finalizado && (
                  <button onClick={startEditFechas} className="text-[10px] font-bold text-dark-muted/50 hover:text-primary-400 transition-all flex items-center gap-1">
                    <Pencil size={10} /> Editar fechas
                  </button>
                )}
                {!canEdit && esLider && !trim.esta_finalizado && (
                  <button onClick={() => handleSolicitarPermiso('editar_trimestre')} className="text-[10px] font-bold text-dark-muted/50 hover:text-amber-400 transition-all flex items-center gap-1">
                    <Pencil size={10} /> Solicitar edición
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Módulos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-dark-text uppercase tracking-widest">
                Módulos ({modulos.length})
              </h2>
              <div className="flex items-center gap-2">
                {canEdit && !trim.esta_finalizado && (
                  <button
                    onClick={() => setShowModModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-600/20 border border-primary-500/30 text-primary-400 text-xs font-bold hover:bg-primary-600/30 transition-all"
                  >
                    <Plus size={12} /> Nuevo módulo
                  </button>
                )}
                {esLider && !isInstructor && !trim.esta_finalizado && (
                  <button
                    onClick={() => handleSolicitarPermiso('crear_modulo')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dark-border text-dark-muted text-xs font-bold hover:border-primary-500/40 hover:text-primary-400 transition-all"
                  >
                    <Plus size={12} /> Solicitar módulo
                  </button>
                )}
              </div>
            </div>

            {modulos.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-dark-border rounded-2xl">
                <Clock size={24} className="mx-auto text-dark-muted mb-2 opacity-40" />
                <p className="text-sm text-dark-muted">
                  {isInstructor ? 'Crea el primer módulo para este trimestre' : 'El instructor aún no ha creado módulos'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {modulos.map((mod: any) => {
                  const tickets    = mod.tickets ?? [];
                  const done       = tickets.filter((t: any) => t.estado === 'done').length;
                  const progreso   = tickets.length > 0 ? Math.round(done / tickets.length * 100) : 0;

                  return (
                    <div
                      key={mod.id}
                      className={`rounded-2xl border p-4 transition-all ${
                        mod.esta_finalizado
                          ? 'border-dark-border bg-dark-card/50 opacity-75'
                          : 'border-dark-border bg-dark-card hover:border-primary-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {mod.esta_finalizado
                            ? <CheckCircle2 size={14} className="text-emerald-400" />
                            : mod.esta_activo
                              ? <Clock size={14} className="text-primary-400" />
                              : <Clock size={14} className="text-dark-muted" />
                          }
                          <span className="text-sm font-bold text-dark-text">{mod.nombre}</span>
                          {mod.esta_activo && !mod.esta_finalizado && (
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-primary-500/15 text-primary-400 border border-primary-500/20">
                              Activo
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-dark-muted">
                            {fmt(mod.fecha_inicio)} → {fmt(mod.fecha_fin)}
                          </span>
                          {canEdit && mod.esta_activo && !mod.esta_finalizado && (
                            <button
                              onClick={() => { if (confirm(`¿Cerrar módulo "${mod.nombre}"?`)) closeModMut.mutate(mod.id); }}
                              className="text-[10px] font-bold text-dark-muted hover:text-emerald-400 transition-all px-2 py-1 rounded-lg border border-dark-border hover:border-emerald-500/30"
                            >
                              Cerrar
                            </button>
                          )}
                        </div>
                      </div>
                      {tickets.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-dark-muted">
                            <span>{tickets.length} tareas</span>
                            <span>{done} completadas · {progreso}%</span>
                          </div>
                          <div className="h-1 bg-dark-bg rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary-500 rounded-full transition-all"
                              style={{ width: `${progreso}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cerrar trimestre */}
          {canEdit && !trim.esta_finalizado && allDone && modulos.length > 0 && (
            <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-emerald-400">Todos los módulos están finalizados</p>
                <p className="text-xs text-dark-muted">Puedes cerrar este trimestre.</p>
              </div>
              <Button
                onClick={() => { if (confirm('¿Cerrar este trimestre? Esta acción no se puede deshacer.')) closeTrimMut.mutate(); }}
                isLoading={closeTrimMut.isPending}
                className="bg-emerald-600 hover:bg-emerald-500 text-xs px-5"
              >
                Cerrar trimestre
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Aside equipo (desplegable desde la derecha) ──────────────────── */}
      {asideOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setAsideOpen(false)}
          />
          <div className="fixed right-0 top-0 h-full w-[300px] z-50 bg-dark-card border-l border-dark-border shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-dark-border">
              <h3 className="text-xs font-black uppercase tracking-widest text-dark-text flex items-center gap-2">
                <Users size={13} className="text-primary-400" /> Equipo del proyecto
              </h3>
              <button onClick={() => setAsideOpen(false)} className="p-1.5 rounded-lg text-dark-muted hover:text-dark-text transition-all">
                <X size={15} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Instructor */}
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-dark-muted mb-2">Instructor</p>
                <div className="flex items-center gap-3 bg-dark-bg rounded-xl p-3 border border-dark-border">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-xs font-black text-indigo-400">
                    {project?.instructor?.nombre?.slice(0, 2).toUpperCase() ?? 'IN'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-dark-text truncate">
                      {project?.instructor?.nombre ?? 'Sin instructor'}
                    </p>
                    <p className="text-[10px] text-dark-muted">Instructor</p>
                  </div>
                </div>
              </div>

              {/* Aprendices */}
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-dark-muted mb-2">
                  Aprendices ({aprendices.length})
                </p>
                {aprendices.length === 0 ? (
                  <p className="text-xs text-dark-muted text-center py-4">Sin aprendices asignados</p>
                ) : (
                  <div className="space-y-2">
                    {aprendices.map((a: any) => (
                      <div key={a.id} className="flex items-center gap-3 bg-dark-bg rounded-xl p-3 border border-dark-border">
                        <div className="w-8 h-8 rounded-full bg-primary-500/20 border border-primary-500/30 flex items-center justify-center text-xs font-black text-primary-400 shrink-0">
                          {a.nombre?.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-dark-text truncate">{a.nombre}</p>
                          <p className="text-[10px] text-dark-muted">
                            {a.es_lider_tecnico ? 'Líder técnico' : 'Aprendiz'}
                          </p>
                        </div>
                        {a.es_lider_tecnico && (
                          <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-primary-500/10 text-primary-400 border border-primary-500/20 shrink-0">
                            Líder
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal crear módulo */}
      <Modal isOpen={showModModal} onClose={() => setShowModModal(false)} title="Nuevo módulo">
        <form
          onSubmit={e => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            createModMut.mutate({
              nombre:       f.get('nombre') as string,
              fecha_inicio: f.get('fecha_inicio') as string,
              fecha_fin:    f.get('fecha_fin') as string,
            });
          }}
          className="space-y-4"
        >
          <FormField label="Nombre del módulo">
            <input
              name="nombre" required
              placeholder="Ej: Módulo 1 — Análisis de requerimientos"
              className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-sm text-dark-text outline-none focus:border-primary-500/50 transition-colors"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Fecha inicio">
              <input
                name="fecha_inicio" type="date" required
                defaultValue={trim.fecha_inicio?.toString().slice(0, 10)}
                className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-sm text-dark-text outline-none focus:border-primary-500/50"
              />
            </FormField>
            <FormField label="Fecha fin">
              <input
                name="fecha_fin" type="date" required
                defaultValue={trim.fecha_fin?.toString().slice(0, 10)}
                className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-sm text-dark-text outline-none focus:border-primary-500/50"
              />
            </FormField>
          </div>
          <button
            type="submit"
            disabled={createModMut.isPending}
            className="w-full py-2.5 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white font-black uppercase tracking-widest rounded-xl text-xs transition-all flex items-center justify-center gap-2"
          >
            {createModMut.isPending
              ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creando...</>
              : 'Crear módulo'}
          </button>
        </form>
      </Modal>
    </div>
  );
};