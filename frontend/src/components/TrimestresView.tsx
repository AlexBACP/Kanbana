// ── REESCRITO COMPLETO ────────────────────────────────────────────────────────
// TrimestresView — Vista de gestión de trimestres de un proyecto.
//
// Mejoras implementadas:
//  1. Soporte hasta 10 trimestres.
//  2. Modal de configuración con fechas personalizables por trimestre.
//  3. Generación automática con división equitativa pero editable.
//  4. Integración real con el backend (generateMut).
//  5. Manejo de sprints sin trimestre (sinTrimestre).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect }                   from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray }                from 'react-hook-form';
import { Link }                                  from 'react-router-dom';
import {
  ChevronDown, ChevronRight, BookOpen, Code2,
  CheckCircle2, Clock, Lock, Plus, Calendar,
  AlertTriangle, Layers, Settings, Link2, Unlink,
  RefreshCw, ArrowRight,
} from 'lucide-react';
import { projectService } from '../services/project.service';
import { Trimestre }      from '../types/trimestre.types';
import { Sprint, Project } from '../types/project.types';
import { useAuthStore }   from '../store/auth.store';
import { Modal }          from './Modal';
import { Button }         from './Button';

function fmt(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function pct(tickets: { estado: string }[] = []) {
  if (!tickets.length) return 0;
  return Math.round(tickets.filter(t => t.estado === 'done').length / tickets.length * 100);
}

interface Props { proyectoId: number }

type ModalType =
  | { type: 'generate' }
  | { type: 'createSprint'; trimestreId: number; trimestreNombre: string }
  | { type: 'editTrimestre'; trimestre: Trimestre }
  | null;

export const TrimestresView = ({ proyectoId }: Props) => {
  const qc       = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin  = user?.rol === 'coordinador' || user?.rol === 'instructor';

  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [modal,    setModal]    = useState<ModalType>(null);

  // ── Queries ───────────────────────────────────────────────────────────────
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

  const { data: sinTrimestre = [] } = useQuery<Sprint[]>({
    queryKey: ['sprints-sin-trimestre', proyectoId],
    queryFn:  () => projectService.getSprintsSinTrimestre(proyectoId),
    enabled:  !!proyectoId,
  });

  // Expandir primer trimestre al cargar
  useEffect(() => {
    if (trimestres.length > 0 && expanded.size === 0) {
      setExpanded(new Set([trimestres[0].id]));
    }
  }, [trimestres]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['trimestres', proyectoId] });
    qc.invalidateQueries({ queryKey: ['sprints-sin-trimestre', proyectoId] });
    qc.invalidateQueries({ queryKey: ['projects', proyectoId] });
  };

  // ── Mutations ─────────────────────────────────────────────────────────────
  const generateMut = useMutation({
    mutationFn: (dto: { num: number; trimestres: any[] }) =>
      projectService.generateTrimestres(proyectoId, dto),
    onSuccess: async (trimestresCreados: any[]) => {
      // ── NUEVO: asignar módulos huérfanos (sin trimestre) al primer trimestre
      const primero = trimestresCreados?.[0];
      if (primero) {
        const huerfanos = sinTrimestre as any[];
        for (const sp of huerfanos) {
          try {
            await projectService.assignSprintToTrimestre(sp.id, primero.id);
          } catch { /* si falla uno no bloqueamos el resto */ }
        }
      }
      invalidate();
      setModal(null);
    },
    onError: (e: any) => alert(e?.response?.data?.message ?? 'Error al generar trimestres'),
  });

  const createSprintMut = useMutation({
    mutationFn: ({ trimestreId, dto }: { trimestreId: number; dto: any }) =>
      projectService.createSprintEnTrimestre(proyectoId, trimestreId, dto),
    onSuccess:  () => { invalidate(); setModal(null); resetSprint(); },
    onError:    (e: any) => alert(e?.response?.data?.message ?? 'Error al crear modulo'),
  });

  const editTrimMut = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: any }) =>
      projectService.updateTrimestre(id, dto),
    onSuccess:  () => { invalidate(); setModal(null); },
    onError:    (e: any) => alert(e?.response?.data?.message ?? 'Error al editar trimestre'),
  });

  const closeTrimMut = useMutation({
    mutationFn: (id: number) => projectService.closeTrimestre(id),
    onSuccess:  invalidate,
    onError:    (e: any) => alert(e?.response?.data?.message ?? 'No se pudo cerrar el trimestre'),
  });

  const assignMut = useMutation({
    mutationFn: ({ sprintId, trimestreId }: { sprintId: number; trimestreId: number | null }) =>
      projectService.assignSprintToTrimestre(sprintId, trimestreId),
    onSuccess:  invalidate,
    onError:    (e: any) => alert(e?.response?.data?.message ?? 'Error al vincular modulo'),
  });

  // ── Forms ─────────────────────────────────────────────────────────────────
  const { register: regGen, handleSubmit: hGen, control: controlGen, watch: watchGen, setValue: setValGen } = useForm({
    defaultValues: {
      num: 3,
      trimestres: [] as any[],
    }
  });

  const { fields: fieldsGen, replace: replaceGen } = useFieldArray({
    control: controlGen,
    name: "trimestres"
  });

  const numTrimestres = watchGen('num');

  // Recalcular trimestres cuando cambia el número o el proyecto
  useEffect(() => {
    if (modal?.type === 'generate' && project?.fecha_inicio) {
      // ── CORREGIDO: cada trimestre SENA dura exactamente 3 meses,
      // no una fracción del proyecto. La fecha fin del proyecto no
      // determina el tamaño de cada trimestre.
      const start = new Date(project.fecha_inicio);

      const newTrims = Array.from({ length: numTrimestres }, (_, i) => {
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
      });
      replaceGen(newTrims);
    }
  }, [numTrimestres, project, modal?.type]);

  const { register: regSprint, handleSubmit: hSprint, reset: resetSprint } =
    useForm<{ nombre: string; fecha_inicio: string; fecha_fin: string }>();

  const { register: regEdit, handleSubmit: hEdit, reset: resetEdit } =
    useForm<{ nombre: string; fecha_inicio: string; fecha_fin: string; tipo: string }>();

  useEffect(() => {
    if (modal?.type === 'editTrimestre') {
      resetEdit({
        nombre:       modal.trimestre.nombre,
        fecha_inicio: modal.trimestre.fecha_inicio?.toString().slice(0, 10),
        fecha_fin:    modal.trimestre.fecha_fin?.toString().slice(0, 10),
        tipo:         modal.trimestre.tipo,
      });
    }
  }, [modal]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-dark-card rounded-[2rem] animate-pulse border border-dark-border" />
        ))}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SIN TRIMESTRES — pantalla de configuración inicial
  // ══════════════════════════════════════════════════════════════════════════
  if (trimestres.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-20 h-20 rounded-[2rem] bg-primary-500/10 border border-primary-500/20 flex items-center justify-center mb-6">
          <Layers size={36} className="text-primary-400" />
        </div>
        <h3 className="text-xl font-black text-dark-text mb-2">Sin trimestres configurados</h3>
        <p className="text-sm text-dark-muted max-w-sm mb-8 leading-relaxed">
          Este proyecto no tiene trimestres. Genéralos para organizar los modulos
          y habilitar la entrega de archivos en el Trimestre 1 (Documental).
        </p>

        {isAdmin ? (
          <Button onClick={() => setModal({ type: 'generate' })} className="flex items-center gap-2 px-8 py-4">
            <Plus size={16} /> Configurar trimestres
          </Button>
        ) : (
          <p className="text-xs text-dark-muted italic opacity-60">
            El instructor debe configurar los trimestres.
          </p>
        )}

        {/* Modal generar */}
        <Modal 
          isOpen={modal?.type === 'generate'} 
          onClose={() => setModal(null)} 
          title="Configuración de Trimestres"
          size="lg"
        >
          <form onSubmit={hGen(data => generateMut.mutate(data))} className="space-y-6">
            <div className="bg-dark-bg/50 border border-dark-border rounded-2xl p-4">
              <label className="block text-xs font-black text-dark-muted uppercase tracking-widest mb-3">
                ¿Cuántos trimestres tendrá el proyecto? (Máx. 10)
              </label>
              <div className="flex items-center gap-4">
                <input 
                  type="range" min="3" max="10" 
                  {...regGen('num', { valueAsNumber: true })}
                  className="flex-1 accent-primary-500"
                />
                <span className="text-2xl font-black text-primary-400 w-8 text-center">{numTrimestres}</span>
              </div>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {fieldsGen.map((field, index) => (
                <div key={field.id} className="bg-dark-card border border-dark-border rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-primary-400 uppercase tracking-widest">
                      Trimestre {index + 1}
                    </span>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border ${
                      index === 0 
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                        : 'bg-primary-500/10 text-primary-400 border-primary-500/20'
                    }`}>
                      {index === 0 ? 'Documental' : 'Desarrollo'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-dark-muted uppercase tracking-tighter">Fecha Inicio</label>
                      <input 
                        type="date" 
                        {...regGen(`trimestres.${index}.fecha_inicio` as const)}
                        className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2 text-xs text-dark-text outline-none focus:border-primary-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-dark-muted uppercase tracking-tighter">Fecha Fin</label>
                      <input 
                        type="date" 
                        {...regGen(`trimestres.${index}.fecha_fin` as const)}
                        className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2 text-xs text-dark-text outline-none focus:border-primary-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button>
              <Button type="submit" isLoading={generateMut.isPending} className="px-8">
                Generar {numTrimestres} trimestres
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VISTA PRINCIPAL — con trimestres
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-4">

      {trimestres.map(trim => {
        const isOpen      = expanded.has(trim.id);
        const isDoc       = trim.tipo === 'documental';
        const sprints     = trim.sprints ?? [];
        const allFinished = sprints.length > 0 && sprints.every(s => s.esta_finalizado);
        const allTickets  = sprints.flatMap(s => (s as any).tickets ?? []);
        const doneTix     = allTickets.filter((t: any) => t.estado === 'done').length;
        const progress    = allTickets.length > 0
          ? Math.round(doneTix / allTickets.length * 100) : 0;

        return (
          <div key={trim.id} className={`rounded-[2rem] border overflow-hidden transition-all ${
            trim.esta_finalizado ? 'border-dark-border opacity-75' :
            isDoc               ? 'border-amber-500/25' :
                                  'border-primary-500/25'
          }`}>

            {/* ── Cabecera ─────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 p-5">

              {/* Expand toggle */}
              <button
                onClick={() => setExpanded(prev => {
                  const n = new Set(prev);
                  n.has(trim.id) ? n.delete(trim.id) : n.add(trim.id);
                  return n;
                })}
                className="flex items-center gap-3 flex-1 text-left min-w-0"
              >
                {/* Ícono tipo */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  trim.esta_finalizado ? 'bg-dark-bg border border-dark-border' :
                  isDoc               ? 'bg-amber-500/10 border border-amber-500/20' :
                                        'bg-primary-500/10 border border-primary-500/20'
                }`}>
                  {trim.esta_finalizado ? <Lock size={15} className="text-dark-muted" /> :
                   isDoc               ? <BookOpen size={15} className="text-amber-400" /> :
                                         <Code2 size={15} className="text-primary-400" />}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-black ${
                      trim.esta_finalizado ? 'text-dark-muted' :
                      isDoc ? 'text-amber-400' : 'text-primary-400'
                    }`}>
                      T{trim.numero}
                    </span>
                    <span className="text-sm font-bold text-dark-text truncate">{trim.nombre}</span>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border ${
                      isDoc
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-primary-500/10 text-primary-400 border-primary-500/20'
                    }`}>
                      {isDoc ? 'Documental' : 'Desarrollo'}
                    </span>
                    {trim.esta_finalizado && (
                      <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                        Finalizado
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-[11px] text-dark-muted flex items-center gap-1">
                      <Calendar size={10} />
                      {fmt(trim.fecha_inicio?.toString())} → {fmt(trim.fecha_fin?.toString())}
                    </span>
                    <span className="text-[11px] text-dark-muted">
                      {sprints.length} modulo{sprints.length !== 1 ? 's' : ''} · {doneTix}/{allTickets.length} tickets
                    </span>
                  </div>
                </div>

                {/* Barra de progreso */}
                {allTickets.length > 0 && (
                  <div className="hidden sm:block w-20 h-1.5 bg-dark-border rounded-full overflow-hidden shrink-0">
                    <div
                      className={`h-full rounded-full transition-all ${progress === 100 ? 'bg-emerald-500' : 'bg-primary-500'}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}

                {isOpen
                  ? <ChevronDown size={16} className="text-dark-muted shrink-0" />
                  : <ChevronRight size={16} className="text-dark-muted shrink-0" />}
              </button>

              {/* Acciones admin */}
              {isAdmin && !trim.esta_finalizado && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setModal({ type: 'editTrimestre', trimestre: trim })}
                    className="p-2 rounded-xl bg-dark-bg border border-dark-border text-dark-muted hover:text-primary-400 hover:border-primary-500/30 transition-all"
                    title="Editar trimestre"
                  >
                    <Settings size={14} />
                  </button>
                  {allFinished && (
                    <button
                      onClick={() => {
                        if (confirm(`¿Cerrar el Trimestre ${trim.numero}? No podrás crear más modulos en él.`)) {
                          closeTrimMut.mutate(trim.id);
                        }
                      }}
                      className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
                    >
                      Cerrar T{trim.numero}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* ── Contenido expandido ───────────────────────────────────── */}
            {isOpen && (
              <div className="px-5 pb-5 border-t border-dark-border/40 pt-4 space-y-3">

                {/* Nota documental */}
                {isDoc && !trim.esta_finalizado && (
                  <div className="flex items-start gap-3 px-4 py-3 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
                    <AlertTriangle size={13} className="text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-400 font-medium">
                      <strong>Trimestre documental:</strong> las tareas de los modulos de este trimestre
                      requieren adjuntar un archivo para poder marcarse como completados.
                    </p>
                  </div>
                )}

                {/* Lista de sprints */}
                {sprints.length === 0 ? (
                  <p className="text-xs text-dark-muted text-center py-6 italic opacity-50">
                    Sin modulos. Crea uno abajo o vincula uno desde "Sin clasificar".
                  </p>
                ) : (
                  sprints.map(sprint => {
                    const stix = (sprint as any).tickets ?? [];
                    const sp   = pct(stix);
                    return (
                      <div key={sprint.id} className="flex items-center gap-4 p-4 bg-dark-bg/40 hover:bg-dark-bg border border-dark-border rounded-2xl transition-all group">
                        {/* Estado */}
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          sprint.esta_finalizado ? 'bg-emerald-500/10 border border-emerald-500/20' :
                          sprint.esta_activo     ? 'bg-primary-500/10 border border-primary-500/20' :
                                                   'bg-dark-bg border border-dark-border'
                        }`}>
                          {sprint.esta_finalizado
                            ? <CheckCircle2 size={13} className="text-emerald-400" />
                            : sprint.esta_activo
                              ? <div className="w-2 h-2 rounded-full bg-primary-400 animate-pulse" />
                              : <Clock size={13} className="text-dark-muted" />}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-dark-text truncate">{sprint.nombre}</p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[11px] text-dark-muted">
                              {fmt(sprint.fecha_inicio)} → {fmt(sprint.fecha_fin)}
                            </span>
                            {stix.length > 0 && (
                              <span className="text-[11px] text-dark-muted">
                                {stix.filter((t: any) => t.estado === 'done').length}/{stix.length} tickets
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Barra sprint */}
                        {stix.length > 0 && (
                          <div className="hidden sm:block w-14 h-1.5 bg-dark-border rounded-full overflow-hidden shrink-0">
                            <div
                              className={`h-full rounded-full ${sp === 100 ? 'bg-emerald-500' : 'bg-primary-500'}`}
                              style={{ width: `${sp}%` }}
                            />
                          </div>
                        )}

                        {/* Badge estado */}
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-xl border shrink-0 ${
                          sprint.esta_finalizado ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          sprint.esta_activo     ? 'bg-primary-500/10 text-primary-400 border-primary-500/20' :
                                                   'bg-dark-bg text-dark-muted border-dark-border'
                        }`}>
                          {sprint.esta_finalizado ? 'Finalizado' : sprint.esta_activo ? 'Activo' : 'Pendiente'}
                        </span>

                        {/* Desvincular */}
                        {isAdmin && !trim.esta_finalizado && (
                          <button
                            onClick={() => assignMut.mutate({ sprintId: sprint.id, trimestreId: null })}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-dark-muted hover:text-rose-400 transition-all shrink-0"
                            title="Quitar de este trimestre"
                          >
                            <Unlink size={13} />
                          </button>
                        )}

                        {/* Ir al tablero */}
                        <Link
                          to={`/projects/${proyectoId}/kanban`}
                          className="opacity-0 group-hover:opacity-100 text-[10px] font-black text-dark-muted hover:text-primary-400 transition-all shrink-0 flex items-center gap-1"
                        >
                          Ver <ArrowRight size={10} />
                        </Link>
                      </div>
                    );
                  })
                )}

                {/* Crear sprint en este trimestre */}
                {isAdmin && !trim.esta_finalizado && (
                  <button
                    onClick={() => setModal({ type: 'createSprint', trimestreId: trim.id, trimestreNombre: trim.nombre })}
                    className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-dark-border rounded-2xl text-xs font-black text-dark-muted uppercase tracking-widest hover:border-primary-500/40 hover:text-primary-400 transition-all"
                  >
                    <Plus size={13} /> Crear sprint en {trim.nombre}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Sprints sin clasificar ────────────────────────────────────────── */}
      {sinTrimestre.length > 0 && (
        <div className="rounded-[2rem] border border-dark-border overflow-hidden">
          <div className="flex items-center gap-3 p-5 border-b border-dark-border bg-dark-card">
            <div className="w-9 h-9 rounded-xl bg-dark-bg border border-dark-border flex items-center justify-center">
              <Link2 size={14} className="text-dark-muted" />
            </div>
            <div>
              <p className="text-sm font-black text-dark-text">modulos sin clasificar</p>
              <p className="text-xs text-dark-muted mt-0.5">
                No están asignados a ningún trimestre. Usa el selector para vincularlos.
              </p>
            </div>
            <span className="ml-auto text-xs font-black text-dark-muted bg-dark-bg border border-dark-border px-3 py-1 rounded-xl">
              {sinTrimestre.length}
            </span>
          </div>

          <div className="p-4 space-y-3">
            {sinTrimestre.map(sprint => (
              <div key={sprint.id} className="flex items-center gap-4 p-4 bg-dark-bg/40 border border-dark-border rounded-2xl">
                {/* Estado */}
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  sprint.esta_finalizado ? 'bg-emerald-500/10 border border-emerald-500/20' :
                  sprint.esta_activo     ? 'bg-primary-500/10 border border-primary-500/20' :
                                           'bg-dark-bg border border-dark-border'
                }`}>
                  {sprint.esta_finalizado
                    ? <CheckCircle2 size={13} className="text-emerald-400" />
                    : sprint.esta_activo
                      ? <div className="w-2 h-2 rounded-full bg-primary-400 animate-pulse" />
                      : <Clock size={13} className="text-dark-muted" />}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-dark-text truncate">{sprint.nombre}</p>
                  <p className="text-[11px] text-dark-muted mt-0.5">
                    {fmt(sprint.fecha_inicio)} → {fmt(sprint.fecha_fin)}
                  </p>
                </div>

                {/* Selector de trimestre */}
                {isAdmin && (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-black text-dark-muted uppercase tracking-widest hidden sm:block">
                      Asignar a:
                    </span>
                    <select
                      defaultValue=""
                      onChange={e => {
                        const val = e.target.value;
                        if (val) {
                          assignMut.mutate({ sprintId: sprint.id, trimestreId: Number(val) });
                        }
                        e.target.value = '';
                      }}
                      className="text-xs font-bold bg-dark-bg border border-dark-border rounded-xl px-3 py-2 text-dark-text outline-none focus:border-primary-500 transition-all cursor-pointer"
                    >
                      <option value="" disabled>Elegir trimestre...</option>
                      {trimestres
                        .filter(t => !t.esta_finalizado)
                        .map(t => (
                          <option key={t.id} value={t.id}>
                            T{t.numero} — {t.nombre}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Reconfigurar (si no hay ninguno finalizado) ───────────────────── */}
      {isAdmin && trimestres.length > 0 && trimestres.every(t => !t.esta_finalizado) && (
        <div className="flex justify-end pt-2">
          <button
            onClick={() => setModal({ type: 'generate' })}
            className="flex items-center gap-2 text-xs font-black text-dark-muted uppercase tracking-widest hover:text-primary-400 transition-colors px-4 py-2 rounded-xl border border-dark-border hover:border-primary-500/30"
          >
            <RefreshCw size={12} /> Reconfigurar trimestres
          </button>
        </div>
      )}

      {/* ══ MODALES ══════════════════════════════════════════════════════════ */}

      {/* Modal generar (desde reconfigurar o inicial) */}
      <Modal 
        isOpen={modal?.type === 'generate'} 
        onClose={() => setModal(null)} 
        title="Configuración de Trimestres"
        size="lg"
      >
        <form onSubmit={hGen(data => generateMut.mutate(data))} className="space-y-6">
          <div className="bg-dark-bg/50 border border-dark-border rounded-2xl p-4">
            <label className="block text-xs font-black text-dark-muted uppercase tracking-widest mb-3">
              ¿Cuántos trimestres tendrá el proyecto? (Máx. 10)
            </label>
            <div className="flex items-center gap-4">
              <input 
                type="range" min="1" max="10" 
                {...regGen('num', { valueAsNumber: true })}
                className="flex-1 accent-primary-500"
              />
              <span className="text-2xl font-black text-primary-400 w-8 text-center">{numTrimestres}</span>
            </div>
          </div>

          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {fieldsGen.map((field, index) => (
              <div key={field.id} className="bg-dark-card border border-dark-border rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-primary-400 uppercase tracking-widest">
                    Trimestre {index + 1}
                  </span>
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border ${
                    index === 0 
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                      : 'bg-primary-500/10 text-primary-400 border-primary-500/20'
                  }`}>
                    {index === 0 ? 'Documental' : 'Desarrollo'}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-dark-muted uppercase tracking-tighter">Fecha Inicio</label>
                    <input 
                      type="date" 
                      {...regGen(`trimestres.${index}.fecha_inicio` as const)}
                      className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2 text-xs text-dark-text outline-none focus:border-primary-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-dark-muted uppercase tracking-tighter">Fecha Fin</label>
                    <input 
                      type="date" 
                      {...regGen(`trimestres.${index}.fecha_fin` as const)}
                      className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2 text-xs text-dark-text outline-none focus:border-primary-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button>
            <Button type="submit" isLoading={generateMut.isPending} className="px-8">
              {trimestres.length > 0 ? 'Reconfigurar' : 'Generar'} {numTrimestres} trimestres
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal crear sprint */}
      <Modal
        isOpen={modal?.type === 'createSprint'}
        onClose={() => { setModal(null); resetSprint(); }}
        title={`Nuevo Sprint — ${modal?.type === 'createSprint' ? modal.trimestreNombre : ''}`}
      >
        <form
          onSubmit={hSprint(data =>
            modal?.type === 'createSprint' &&
            createSprintMut.mutate({ trimestreId: modal.trimestreId, dto: data })
          )}
          className="space-y-5"
        >
          <div className="space-y-2">
            <label className="block text-xs font-black text-dark-muted uppercase tracking-widest">Nombre</label>
            <input
              {...regSprint('nombre', { required: true })}
              className="w-full px-5 py-4 bg-dark-bg/50 border border-dark-border rounded-2xl text-sm text-dark-text outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all placeholder:text-dark-muted/30"
              placeholder="Ej: Sprint 1 — Levantamiento de requisitos"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-muted uppercase tracking-widest">Inicio</label>
              <input type="date" {...regSprint('fecha_inicio', { required: true })}
                className="w-full px-5 py-4 bg-dark-bg/50 border border-dark-border rounded-2xl text-sm text-dark-text outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all" />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-muted uppercase tracking-widest">Fin</label>
              <input type="date" {...regSprint('fecha_fin', { required: true })}
                className="w-full px-5 py-4 bg-dark-bg/50 border border-dark-border rounded-2xl text-sm text-dark-text outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => { setModal(null); resetSprint(); }}>Cancelar</Button>
            <Button type="submit" isLoading={createSprintMut.isPending}>Crear Sprint</Button>
          </div>
        </form>
      </Modal>

      {/* Modal editar trimestre */}
      <Modal
        isOpen={modal?.type === 'editTrimestre'}
        onClose={() => setModal(null)}
        title={`Editar — ${modal?.type === 'editTrimestre' ? modal.trimestre.nombre : ''}`}
      >
        <form
          onSubmit={hEdit(data =>
            modal?.type === 'editTrimestre' &&
            editTrimMut.mutate({ id: modal.trimestre.id, dto: data })
          )}
          className="space-y-5"
        >
          <div className="space-y-2">
            <label className="block text-xs font-black text-dark-muted uppercase tracking-widest">Nombre</label>
            <input
              {...regEdit('nombre', { required: true })}
              className="w-full px-5 py-4 bg-dark-bg/50 border border-dark-border rounded-2xl text-sm text-dark-text outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-black text-dark-muted uppercase tracking-widest">Tipo</label>
            <select
              {...regEdit('tipo')}
              className="w-full px-5 py-4 bg-dark-bg/50 border border-dark-border rounded-2xl text-sm text-dark-text outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all"
            >
              <option value="documental">Documental — requiere adjuntos en tareas</option>
              <option value="desarrollo">Desarrollo — adjuntos opcionales</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-muted uppercase tracking-widest">Inicio</label>
              <input type="date" {...regEdit('fecha_inicio', { required: true })}
                className="w-full px-5 py-4 bg-dark-bg/50 border border-dark-border rounded-2xl text-sm text-dark-text outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all" />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-muted uppercase tracking-widest">Fin</label>
              <input type="date" {...regEdit('fecha_fin', { required: true })}
                className="w-full px-5 py-4 bg-dark-bg/50 border border-dark-border rounded-2xl text-sm text-dark-text outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button>
            <Button type="submit" isLoading={editTrimMut.isPending}>Guardar cambios</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
