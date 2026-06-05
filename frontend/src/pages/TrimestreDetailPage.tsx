/**
 * TrimestreDetailPage — ruta /projects/:id/trimestre/:trimestreId
 *
 * Página de detalle de un trimestre. Muestra:
 *   - Info del trimestre (nombre, fechas, tipo)
 *   - Lista de módulos (sprints) del trimestre
 *   - Mini-aside desplegable con aprendices + instructor del proyecto
 *   - Botón "Tablero" → navega al kanban en la misma pestaña
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
  ChevronRight, X, AlertTriangle,
  Pencil, Check, Layers,
} from 'lucide-react';
import { projectService } from '../services/project.service';
import { userService }    from '../services/user.service';
import { useAuthStore }   from '../store/auth.store';
import { Button }              from '../components/Button';
import { DateTimeInput }       from '../components/DateTimeInput';
import { SugerenciasCompactas } from '../components/SugerenciasCompactas';
import type { Trimestre } from '../types/trimestre.types';
import { AnimatePresence, motion } from 'framer-motion';
import { permisosService } from '../services/permisos.service';
import { ModuloExpandible } from '../components/ModuloExpandible';

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
  // Form del nuevo módulo — controlado para poder pre-rellenar desde sugerencias
  const [modForm,        setModForm]         = useState({ nombre: '', descripcion: '', fecha_inicio: '', fecha_fin: '' });

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

  // FIX: usa POST /projects/:id/sprints con trimestre_id en el body.
  // El endpoint createSprintEnTrimestre no existe en el backend.
  const createModMut = useMutation({
    mutationFn: (dto: any) => projectService.createSprint(proyectoId, { ...dto, trimestre_id: trimId }),
    onSuccess:  () => { invalidate(); setShowModModal(false); },
    onError:    (e: any) => alert(e?.response?.data?.message ?? 'Error al crear módulo'),
  });

  const closeModMut = useMutation({
    mutationFn: (sprintId: number) => projectService.closeSprint(sprintId),
    onSuccess:  invalidate,
    onError:    (e: any) => alert(e?.response?.data?.message ?? 'No se pudo cerrar el módulo'),
  });

  const startModMut = useMutation({
    mutationFn: (sprintId: number) => projectService.startSprint(sprintId),
    onSuccess:  invalidate,
    onError:    (e: any) => alert(e?.response?.data?.message ?? 'No se pudo activar el módulo'),
  });

  const closeTrimMut = useMutation({
    mutationFn: () => projectService.closeTrimestre(trimId),
    onSuccess:  invalidate,
    onError:    (e: any) => alert(e?.response?.data?.message ?? 'No se pudo cerrar el trimestre'),
  });

  // ── Derivados ──────────────────────────────────────────────────────────────
  const modulos    = trim?.sprints ?? [];
  const aprendices = (members as any[]).filter((m: any) => m.rol === 'aprendiz');

  // Instructor: usa la relación del proyecto; si no viene (proyecto sin instructorId),
  // cae en el usuario actual (cuando es instructor/coordinador) o en el de la ficha.
  const instructorDisplay: { nombre: string; correo?: string } | null =
    (project as any)?.instructor ??
    ((user?.rol === 'instructor' || user?.rol === 'coordinador') ? user : null);

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

  // ── FIX: navegar en la misma pestaña (antes usaba window.open → nueva pestaña) ──
  const abrirTablero = () => {
    navigate(`/projects/${proyectoId}/trimestre/${trimId}/kanban`);
  };

  if (!trim) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-zinc-500 text-sm">Cargando trimestre...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Contenido principal ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800 bg-zinc-900 shrink-0">
          {/* FIX: navigate(-1) en lugar de navigate('/projects/...') para evitar bucle en historial */}
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl hover:bg-zinc-950/60 text-zinc-500 hover:text-zinc-100 transition-all"
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
                  className="bg-zinc-950 border border-primary-500/50 rounded-xl px-3 py-1.5 text-sm font-black text-zinc-100 outline-none"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') saveNombre(); if (e.key === 'Escape') setEditingNombre(false); }}
                />
                <button onClick={saveNombre} className="p-1.5 rounded-lg bg-primary-500/20 text-primary-400 hover:bg-primary-500/30 transition-all">
                  <Check size={14} />
                </button>
                <button onClick={() => setEditingNombre(false)} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-100 transition-all">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black text-zinc-100 truncate">
                  {trim.nombre || `Trimestre ${trim.numero}`}
                </h1>
                {canEdit && (
                  <button onClick={startEditNombre} className="p-1 rounded-lg text-zinc-500/40 hover:text-primary-400 transition-all">
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
                <span className="text-[10px] font-black uppercase text-zinc-500 flex items-center gap-1">
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
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-800 text-xs font-bold text-zinc-500 hover:text-zinc-100 hover:border-primary-500/40 transition-all"
            >
              <Users size={14} /> Equipo
            </button>

            {/* Botón cola de trabajo — consistencia con los demás flujos */}
            <button
              onClick={() => navigate(`/projects/${proyectoId}/backlog?trimestreId=${trimId}`)}
              title="Abrir la cola de trabajo de este trimestre"
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-800 text-xs font-bold text-zinc-500 hover:text-zinc-100 hover:border-zinc-600 transition-all"
            >
              <Layers size={14} /> Cola de trabajo
            </button>

            {/* Botón tablero — navega en la misma pestaña */}
            <button
              onClick={abrirTablero}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold transition-all shadow-md shadow-primary-500/20"
            >
              <KanbanSquare size={14} /> Tablero
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
                    <DateTimeInput
                      value={fechasDraft.inicio}
                      onChange={e => setFechasDraft(f => ({ ...f, inicio: e.target.value }))}
                    />
                  </FormField>
                  <FormField label="Fecha fin">
                    <DateTimeInput
                      value={fechasDraft.fin}
                      onChange={e => setFechasDraft(f => ({ ...f, fin: e.target.value }))}
                      min={fechasDraft.inicio || undefined}
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
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <Calendar size={14} />
                  <span>{fmt(trim.fecha_inicio?.toString())} → {fmt(trim.fecha_fin?.toString())}</span>
                </div>
                {canEdit && !trim.esta_finalizado && (
                  <button onClick={startEditFechas} className="text-[10px] font-bold text-zinc-500/50 hover:text-primary-400 transition-all flex items-center gap-1">
                    <Pencil size={10} /> Editar fechas
                  </button>
                )}
                {!canEdit && esLider && !trim.esta_finalizado && (
                  <button onClick={() => handleSolicitarPermiso('editar_trimestre')} className="text-[10px] font-bold text-zinc-500/50 hover:text-amber-400 transition-all flex items-center gap-1">
                    <Pencil size={10} /> Solicitar edición
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Módulos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-zinc-100 uppercase tracking-widest">
                Módulos ({modulos.length})
              </h2>
              <div className="flex items-center gap-2">
                {canEdit && !trim.esta_finalizado && (
                  <button
                    onClick={() => {
                      // Pre-inicializar el form con las fechas del trimestre
                      setModForm({
                        nombre: '',
                        descripcion: '',
                        fecha_inicio: trim.fecha_inicio?.toString().slice(0, 10) ?? '',
                        fecha_fin:    trim.fecha_fin?.toString().slice(0, 10)    ?? '',
                      });
                      setShowModModal(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-600/20 border border-primary-500/30 text-primary-400 text-xs font-bold hover:bg-primary-600/30 transition-all"
                  >
                    <Plus size={12} /> Nuevo módulo
                  </button>
                )}
                {esLider && !isInstructor && !trim.esta_finalizado && (
                  <button
                    onClick={() => handleSolicitarPermiso('crear_modulo')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-800 text-zinc-500 text-xs font-bold hover:border-primary-500/40 hover:text-primary-400 transition-all"
                  >
                    <Plus size={12} /> Solicitar módulo
                  </button>
                )}
              </div>
            </div>

            {modulos.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-zinc-800 rounded-2xl">
                <Clock size={24} className="mx-auto text-zinc-500 mb-2 opacity-40" />
                <p className="text-sm text-zinc-500">
                  {isInstructor ? 'Crea el primer módulo para este trimestre' : 'El instructor aún no ha creado módulos'}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {modulos.map((mod: any) => (
                  <ModuloExpandible
                    key={mod.id}
                    mod={mod}
                    proyectoId={proyectoId}
                    canEdit={canEdit}
                    onClose={(sprintId) => closeModMut.mutate(sprintId)}
                    onActivate={(sprintId) => startModMut.mutate(sprintId)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Cerrar trimestre */}
          {canEdit && !trim.esta_finalizado && allDone && modulos.length > 0 && (
            <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-emerald-400">Todos los módulos están finalizados</p>
                <p className="text-xs text-zinc-500">Puedes cerrar este trimestre.</p>
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
          <div className="fixed right-0 top-0 h-full w-[300px] z-50 bg-zinc-900 border-l border-zinc-800 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-100 flex items-center gap-2">
                <Users size={13} className="text-primary-400" /> Equipo del proyecto
              </h3>
              <button onClick={() => setAsideOpen(false)} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-100 transition-all">
                <X size={15} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Instructor */}
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">Instructor</p>
                {instructorDisplay ? (
                  <div className="flex items-center gap-3 bg-zinc-950 rounded-xl p-3 border border-zinc-800">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-xs font-black text-indigo-400 overflow-hidden shrink-0">
                      {userService.getAvatarUrl((instructorDisplay as any).avatar_url)
                        ? <img src={userService.getAvatarUrl((instructorDisplay as any).avatar_url)!} alt="" className="w-full h-full object-cover" />
                        : instructorDisplay.nombre?.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-zinc-100 truncate">{instructorDisplay.nombre}</p>
                      <p className="text-[10px] text-zinc-500">Instructor</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-zinc-950 border border-dashed border-zinc-700 rounded-xl">
                    <p className="text-[11px] text-zinc-600 italic">Sin instructor asignado</p>
                  </div>
                )}
              </div>

              {/* Aprendices */}
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">
                  Aprendices ({aprendices.length})
                </p>
                {aprendices.length === 0 ? (
                  <p className="text-xs text-zinc-500 text-center py-4">Sin aprendices asignados</p>
                ) : (
                  <div className="space-y-2">
                    {aprendices.map((a: any) => (
                      <div key={a.id} className="flex items-center gap-3 bg-zinc-950 rounded-xl p-3 border border-zinc-800">
                        <div className="w-8 h-8 rounded-full bg-primary-500/20 border border-primary-500/30 flex items-center justify-center text-xs font-black text-primary-400 shrink-0 overflow-hidden">
                          {userService.getAvatarUrl(a.avatar_url)
                            ? <img src={userService.getAvatarUrl(a.avatar_url)!} alt="" className="w-full h-full object-cover" />
                            : a.nombre?.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-zinc-100 truncate">{a.nombre}</p>
                          <p className="text-[10px] text-zinc-500">
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

      {/* ── Aside: Crear módulo (dos columnas: form + sugerencias) ───────── */}
      <AnimatePresence>
        {showModModal && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setShowModModal(false)}
            />
            <motion.aside
              className="fixed top-0 right-0 h-full w-full max-w-[880px] bg-zinc-950 border-l border-zinc-800 shadow-2xl z-50 flex"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            >
              {/* ── IZQUIERDA: formulario ────────────────────────────────── */}
              <div className="w-1/2 border-r border-zinc-800 flex flex-col">
                {/* Header */}
                <div className="shrink-0 flex items-center justify-between px-6 py-5 border-b border-zinc-800 bg-zinc-900/60">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                      {trim.nombre}
                    </p>
                    <h2 className="text-[16px] font-black text-white tracking-tight mt-0.5">
                      Nuevo módulo
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowModModal(false)}
                    className="p-2 rounded-xl text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-all"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Body */}
                <form
                  id="modulo-form"
                  onSubmit={e => {
                    e.preventDefault();
                    createModMut.mutate({
                      nombre:       modForm.nombre,
                      descripcion:  modForm.descripcion || undefined,
                      fecha_inicio: modForm.fecha_inicio,
                      fecha_fin:    modForm.fecha_fin,
                    });
                  }}
                  className="flex-1 overflow-y-auto p-6 space-y-5"
                >
                  <FormField label="Nombre del módulo *">
                    <input
                      value={modForm.nombre}
                      onChange={e => setModForm(f => ({ ...f, nombre: e.target.value }))}
                      required
                      autoFocus
                      placeholder={`T${trim.numero} MOD-${(trim.sprints?.length ?? 0) + 1}`}
                      className="input-dark w-full"
                    />
                  </FormField>

                  <FormField label="Descripción / Objetivos">
                    <textarea
                      value={modForm.descripcion}
                      onChange={e => setModForm(f => ({ ...f, descripcion: e.target.value }))}
                      rows={4}
                      placeholder="¿Qué debe lograr el equipo al finalizar este módulo?"
                      className="input-dark w-full resize-none"
                    />
                  </FormField>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Fecha inicio *">
                      <DateTimeInput
                        value={modForm.fecha_inicio}
                        onChange={e => setModForm(f => ({ ...f, fecha_inicio: e.target.value }))}
                        required
                        min={trim.fecha_inicio?.toString().slice(0, 10)}
                        max={trim.fecha_fin?.toString().slice(0, 10)}
                        rangeLabel={`T${trim.numero} — rango del trimestre`}
                      />
                    </FormField>
                    <FormField label="Fecha fin *">
                      <DateTimeInput
                        value={modForm.fecha_fin}
                        onChange={e => setModForm(f => ({ ...f, fecha_fin: e.target.value }))}
                        required
                        min={trim.fecha_inicio?.toString().slice(0, 10)}
                        max={trim.fecha_fin?.toString().slice(0, 10)}
                      />
                    </FormField>
                  </div>
                </form>

                {/* Footer */}
                <div className="shrink-0 px-6 py-4 border-t border-zinc-800 bg-zinc-900/40 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModModal(false)}
                    className="px-5 py-2.5 rounded-xl border border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 text-[11px] font-black uppercase tracking-widest transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    form="modulo-form"
                    disabled={createModMut.isPending || !modForm.nombre.trim()}
                    className="px-6 py-2.5 rounded-xl bg-primary-600/20 border border-primary-500/40 text-primary-400 hover:bg-primary-600/30 hover:border-primary-500/60 text-[11px] font-black uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {createModMut.isPending && (
                      <span className="w-3.5 h-3.5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                    )}
                    Crear módulo
                  </button>
                </div>
              </div>

              {/* ── DERECHA: sugerencias del trimestre ────────────────────── */}
              <div className="w-1/2 bg-zinc-950/40 overflow-hidden">
                <SugerenciasCompactas
                  proyectoId={proyectoId}
                  trimestreId={trimId}
                  canManage={canEdit}
                  onPreFill={({ nombre, descripcion }) => {
                    setModForm(f => ({
                      ...f,
                      nombre,
                      descripcion: descripcion ?? f.descripcion,
                    }));
                  }}
                />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
