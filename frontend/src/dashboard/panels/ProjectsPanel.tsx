/**
 * ProjectsPanel — Proyectos organizados por ficha.
 * - Coordinador: ve todas las fichas con sus proyectos
 * - Instructor: solo sus fichas
 * - Otros roles: vista plana de sus proyectos
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectService } from '../../services/project.service';
import { userService } from '../../services/user.service';
import { fichaService } from '../../services/ficha.service';
import { useAuthStore } from '../../store/auth.store';
import { Modal } from '../../components/Modal';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, Trash2, FolderKanban, LayoutGrid,
  AlertCircle, AlertTriangle, Hash, ChevronRight, Layers,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useForm, useFieldArray } from 'react-hook-form';

// Configuración de estados mapeada a los badges premium del prototipo HTML
const STATUS_CONFIG = {
  activo: { label: 'Activo', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  pausado: { label: 'En pausa', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  finalizado: { label: 'Finalizado', badge: 'bg-zinc-500/10 text-zinc-400 border-zinc-700/30' },
};

const FormField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-[12px] font-bold text-zinc-400 uppercase tracking-wider">{label}</label>
    {children}
  </div>
);

// ── Fila de proyecto ──────────────────────────────────────────────────────────
const ProjectRow = ({ proj, canCreate, isCoordinador, onDelete, updateStatusMutation, navigate, leaders = [], queryClient }: any) => {
  const sc = STATUS_CONFIG[proj.estado as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.activo;
  return (
    <tr className="hover:bg-zinc-800/30 transition-colors group border-b border-zinc-600/40">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-zinc-950 border border-zinc-600 flex items-center justify-center font-bold text-[#3b82f6] text-[11px] shadow-inner group-hover:border-[#3b82f6]/40 transition-colors shrink-0">
            <FolderKanban size={13} className="text-[#3b82f6]" />
          </div>
          <div>
            <span
              onClick={() => navigate(`/projects/${proj.id}`)}
              className="text-white font-bold tracking-tight text-sm group-hover:text-[#3b82f6] transition-colors cursor-pointer"
            >
              {proj.nombre}
            </span>
            <div className="text-[10px] text-zinc-500 font-normal line-clamp-1">{proj.descripcion}</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="relative inline-block">
          <select
            value={proj.estado}
            onChange={e => updateStatusMutation.mutate({ id: proj.id, estado: e.target.value })}
            className={`cursor-pointer outline-none appearance-none rounded-md px-2.5 py-1 text-[10px] uppercase font-black tracking-wider text-center border transition-all ${sc.badge}`}
            disabled={!canCreate}
          >
            <option value="activo" className="bg-zinc-900 text-emerald-400">Activo</option>
            <option value="pausado" className="bg-zinc-900 text-amber-400">En pausa</option>
            <option value="finalizado" className="bg-zinc-900 text-zinc-400">Finalizado</option>
          </select>
        </div>
      </td>
      <td className="px-6 py-4">
        {canCreate && leaders.length > 0 ? (
          <select
            defaultValue={proj.liderId || proj.lider?.id || ''}
            onChange={e => {
              projectService.assignLider(proj.id, Number(e.target.value) || 0)
                .then(() => {
                  queryClient.invalidateQueries({ queryKey: ['projects'] });
                  queryClient.invalidateQueries({ queryKey: ['users'] });
                  queryClient.invalidateQueries({ queryKey: ['projects', 'for-me'] });
                });
            }}
            className="text-[10px] bg-zinc-900 border border-zinc-600 rounded-lg px-2.5 py-1.5 text-zinc-300 outline-none cursor-pointer max-w-[140px] font-medium focus:border-blue-600 transition-colors"
          >
            <option value="" className="bg-zinc-900 text-zinc-500">Sin líder</option>
            {leaders.map((l: any) => (
              <option key={l.id} value={l.id} className="bg-zinc-900 text-zinc-300">{l.nombre}</option>
            ))}
          </select>
        ) : proj.lider ? (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <span className="text-[8px] font-bold text-emerald-400">{proj.lider.nombre?.slice(0, 2).toUpperCase()}</span>
            </div>
            <span className="text-[12px] font-semibold text-zinc-300">{proj.lider.nombre}</span>
          </div>
        ) : (
          <span className="text-[12px] text-zinc-500 italic">Sin asignar</span>
        )}
      </td>
      <td className="px-6 py-4">
        <p className="text-[12px] font-medium text-zinc-400 tabular-nums">{proj.fecha_inicio} <span className="text-zinc-600">→</span> {proj.fecha_fin}</p>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => navigate(`/projects/${proj.id}`)}
            className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-md text-[12px] font-bold border border-zinc-600 transition-all active:scale-95"
          >
            <LayoutGrid size={12} /> Tablero
          </button>
          {isCoordinador && (
            <button
              onClick={() => onDelete(proj)}
              className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 rounded-md transition-colors"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};

// ── Bloque de ficha con sus proyectos ─────────────────────────────────────────
const FichaProjectBlock = ({ ficha, projects, canCreate, isCoordinador, search, onDelete, updateStatusMutation, navigate, queryClient }: any) => {
  const [open, setOpen] = useState(true);

  // Solo los líderes técnicos de ESTA ficha — nunca de otras fichas
  const { data: fichaMembers = [] } = useQuery({
    queryKey: ['fichas', ficha.id, 'members'],
    queryFn:  () => fichaService.getMembers(ficha.id),
    staleTime: 60_000,
    enabled:  canCreate && !!ficha.id,
  });
  const fichaLeaders = (fichaMembers as any[]).filter(
    (u: any) => u.rol === 'aprendiz' && u.es_lider_tecnico,
  );

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return projects;
    return projects.filter((p: any) => p.nombre?.toLowerCase().includes(term) || p.descripcion?.toLowerCase().includes(term));
  }, [projects, search]);

  const activos = projects.filter((p: any) => p.estado === 'activo').length;

  return (
    <div className="bg-zinc-900/95 border border-zinc-600/80 rounded-md overflow-hidden shadow-lg mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-800/40 transition-colors text-left bg-zinc-950/20 border-b border-zinc-600/40"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#3b82f6]/10 border border-[#3b82f6]/20 flex items-center justify-center shrink-0">
            <Hash size={14} className="text-[#3b82f6]" />
          </div>
          <div>
            <p className="text-sm font-black text-white tracking-tight">Ficha {ficha.codigo}</p>
            <p className="text-[11px] text-zinc-400 font-medium">{ficha.programa}</p>
          </div>
          {ficha.instructor && (
            <span className="ml-3 text-[10px] font-bold text-zinc-400 bg-zinc-900 border border-zinc-600 rounded px-2 py-0.5 uppercase tracking-wide">
              {ficha.instructor.nombre}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-2 text-[10px] font-bold uppercase tracking-wider">
            <span className="text-emerald-400">{activos} activo{activos !== 1 ? 's' : ''}</span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-500">{projects.length} total</span>
          </div>
          <ChevronRight size={14} className={`text-zinc-400 transition-transform ${open ? 'rotate-90' : ''}`} />
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
            className="overflow-hidden bg-zinc-900/40"
          >
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-[12px] font-medium text-zinc-500 italic">
                {search ? 'Sin coincidencias en esta ficha' : 'Sin proyectos en esta ficha'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-600 bg-zinc-950/40">
                      <th className="px-6 py-3 text-[10px] uppercase tracking-[0.15em] font-black text-zinc-400">Proyecto</th>
                      <th className="px-6 py-3 text-[10px] uppercase tracking-[0.15em] font-black text-zinc-400">Estado</th>
                      <th className="px-6 py-3 text-[10px] uppercase tracking-[0.15em] font-black text-zinc-400">Líder</th>
                      <th className="px-6 py-3 text-[10px] uppercase tracking-[0.15em] font-black text-zinc-400">Fechas</th>
                      <th className="px-6 py-3 text-[10px] uppercase tracking-[0.15em] font-black text-zinc-400 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40 font-medium text-[12px]">
                    {filtered.map((proj: any) => (
                      <ProjectRow key={proj.id} proj={proj} canCreate={canCreate}
                        isCoordinador={isCoordinador} onDelete={onDelete}
                        updateStatusMutation={updateStatusMutation} navigate={navigate}
                        leaders={fichaLeaders} queryClient={queryClient}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Panel principal ────────────────────────────────────────────────────────────
export const ProjectsPanel = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false); // Controla la visibilidad inline del formulario
  const [numTrimestresNew, setNumTrimestresNew] = useState(3);
  // ficha seleccionada en el formulario "Nuevo proyecto" — para escopar el dropdown de líder
  const [formFichaId, setFormFichaId] = useState<number | null>(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; nombre: string } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const esLider = user?.rol === 'aprendiz' && (user as any)?.es_lider_tecnico;
  const esAprendiz = user?.rol === 'aprendiz';

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', 'for-role', user?.id],
    queryFn: () => esAprendiz ? projectService.getForMe() : projectService.getAll(),
    enabled: !!user?.id,
  });

  const { register: regBulk, handleSubmit: hBulk, control: controlBulk, watch: watchBulk } = useForm({
    defaultValues: { num: 3, trimestres: [] as any[] }
  });

  const { fields: fieldsBulk, replace: replaceBulk } = useFieldArray({
    control: controlBulk,
    name: "trimestres"
  });

  const numTrimestres = watchBulk('num');

  useMemo(() => {
    if (!isBulkModalOpen) return;

    const start = new Date();
    const end = new Date();
    end.setMonth(end.getMonth() + 12);

    const duration = (end.getTime() - start.getTime()) / numTrimestres;

    const newTrims = Array.from({ length: numTrimestres }, (_, i) => {
      const s = new Date(start.getTime() + i * duration);
      const e = new Date(start.getTime() + (i + 1) * duration - 1);
      return {
        nombre: `Trimestre ${i + 1}`,
        fecha_inicio: s.toISOString().slice(0, 10),
        fecha_fin: e.toISOString().slice(0, 10),
        tipo: i === 0 ? 'documental' : 'desarrollo'
      };
    });
    replaceBulk(newTrims);
  }, [numTrimestres, isBulkModalOpen]);

  const bulkMutation = useMutation({
    mutationFn: (data: any) => projectService.bulkGenerateTrimestres({
      projectIds: (projects as any[]).map(p => p.id),
      ...data
    }),
    onSuccess: async (res: any) => {
      let migrados = 0;
      for (const proj of (projects as any[])) {
        try {
          const huerfanos = await projectService.getSprintsSinTrimestre(proj.id);
          if ((huerfanos as any[]).length > 0) {
            const trims = await projectService.getTrimestres(proj.id);
            const primero = (trims as any[])[0];
            if (primero) {
              for (const sp of (huerfanos as any[])) {
                await projectService.assignSprintToTrimestre(sp.id, primero.id);
                migrados++;
              }
            }
          }
        } catch { /* continuar */ }
      }
      const msg = migrados > 0
        ? `Completado: ${res.success} proyectos configurados, ${migrados} módulo(s) migrado(s) al primer trimestre.`
        : `Completado: ${res.success} proyectos configurados.`;
      alert(msg);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsBulkModalOpen(false);
    },
    onError: (err: any) => alert(err?.response?.data?.message || 'Error en configuración masiva'),
  });

  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => userService.getAll() });
  const { data: fichas = [] } = useQuery({ queryKey: ['fichas'], queryFn: () => fichaService.getAll() });

  // Global: solo se usa como fallback / coordinador sin ficha seleccionada
  const leaders = (users as any[]).filter((u: any) => u.rol === 'aprendiz' && u.es_lider_tecnico);

  // Líderes técnicos de la ficha elegida en el formulario "Nuevo proyecto"
  const { data: formFichaMembers = [] } = useQuery({
    queryKey: ['fichas', formFichaId, 'members'],
    queryFn:  () => fichaService.getMembers(formFichaId!),
    staleTime: 60_000,
    enabled:  isModalOpen && !!formFichaId,
  });
  const formLeaders = formFichaId
    ? (formFichaMembers as any[]).filter((u: any) => u.rol === 'aprendiz' && u.es_lider_tecnico)
    : leaders; // fallback: todos los líderes si no se eligió ficha aún

  const deleteMutation = useMutation({
    mutationFn: projectService.delete,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects'] }); setDeleteTarget(null); setDeleteError(null); },
    onError: (err: any) => {
      setDeleteError(err?.response?.data?.message || 'No se pudo eliminar el proyecto. Intenta de nuevo.');
    },
  });

  const createMutation = useMutation({
    mutationFn: projectService.create,
    onSuccess: async (proyecto: any) => {
      try {
        await projectService.generateTrimestres(proyecto.id, { num: numTrimestresNew });
      } catch { /* No bloquear flujo */ }
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsModalOpen(true);
      setNumTrimestresNew(3);
      setFormFichaId(null);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, estado }: any) => projectService.updateStatus(id, estado),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    createMutation.mutate({
      nombre: f.get('nombre') as string,
      descripcion: f.get('descripcion') as string,
      liderId: Number(f.get('liderId')) || undefined,
      fichaId: Number(f.get('fichaId')) || undefined,
      instructorId: user?.id,
      competencia: f.get('competencia') as string,
      resultado_aprendizaje: f.get('resultado_aprendizaje') as string,
      fecha_inicio: f.get('fecha_inicio') as string,
      fecha_fin: f.get('fecha_fin') as string,
    } as any);
  };

  const p = projects as any[];
  const fichasArr = fichas as any[];
  const isCoordinador = user?.rol === 'coordinador';
  const canCreate = user?.rol === 'coordinador' || user?.rol === 'instructor';

  const filteredProjects = useMemo(() =>
    p.filter(proj => statusFilter === 'all' || proj.estado === statusFilter),
    [p, statusFilter]
  );

  const showFichaView = user?.rol === 'coordinador' || user?.rol === 'instructor';

  const fichaGroups = useMemo(() => {
    const byFicha = fichasArr.map(f => ({
      ficha: f,
      projects: filteredProjects.filter(proj => proj.ficha?.id === f.id || proj.fichaId === f.id),
    })).filter(g => g.projects.length > 0);

    const sinFicha = filteredProjects.filter(proj => !proj.ficha && !proj.fichaId);
    return { byFicha, sinFicha };
  }, [filteredProjects, fichasArr]);

  return (
    <div className="w-full text-zinc-100 bg-zinc-900 min-h-screen">
      {/* Encabezado Principal Premium */}
      <div className="flex items-left bg-zinc-900 pt-10 pl-10 gap-4 flex-col border-b border-zinc-600/60">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight">
            {esAprendiz ? 'Proyectos' : 'Proyectos'}
          </h2>
          {/*<p className="text-[12px] font-semibold text-zinc-400 mt-0.5">
            {esAprendiz
              ? p.length === 0 ? 'Aún no estás vinculado a ningún proyecto' : `${p.length} proyecto(s) asignado(s)`
              : `${totalActivos} activos · ${p.length} proyectos en total`
            }
          </p>*/}
        </div>
        <div className="flex items-center gap-5 flex-wrap">
          {/* Botón: Todos los proyectos (Activo si no hay modales abiertos) */}
          <button
            onClick={() => {
              setIsModalOpen(false);
              setIsBulkModalOpen(false);
            }}
            className={`inline-flex items-center justify-center gap-2 py-3 text-xl font-black border-b transition-all duration-200 ${!isModalOpen && !isBulkModalOpen
                ? 'text-blue-400 border-white'
                : 'text-zinc-400 border-transparent hover:text-blue-400 hover:border-white'
              }`}
          >
            Todos los proyectos
          </button>

          {/* Botón: Configurar trimestres (Activo si el modal masivo está abierto) */}
          {(isCoordinador || user?.rol === 'instructor') && (
            <button
              onClick={() => {
                setIsBulkModalOpen(true);
                setIsModalOpen(false);
              }}
              className={`inline-flex items-center justify-center gap-2 py-3 text-xl font-black border-b transition-all duration-200 ${isBulkModalOpen
                  ? 'text-blue-400 border-white'
                  : 'text-zinc-400 border-transparent hover:text-blue-400 hover:border-white'
                }`}
              title="Generar trimestres para todos los proyectos y migrar módulos existentes"
            >
              <Layers size={0} className={isBulkModalOpen ? 'text-blue-400' : 'text-[#3b82f6]'} />
              Configurar trimestres
            </button>
          )}

          {/* Botón: Nuevo proyecto (Activo si el modal de creación está abierto) */}
          {canCreate && (
            <button
              onClick={() => {
                setIsModalOpen(true);
                setIsBulkModalOpen(false);
              }}
              className={`inline-flex items-center justify-center gap-2 py-3 text-xl font-black border-b transition-all duration-200 ${isModalOpen
                  ? 'text-blue-400 border-white'
                  : 'text-zinc-400 border-transparent hover:text-blue-400 hover:border-white'
                }`}
            >
              <Plus size={16} />
              Nuevo proyecto
            </button>
          )}
        </div>
      </div>


      {/* ── SECCIÓN CAMBIANTE DEL PANEL (DE AHÍ PARA ABAJO) ────────────────────── */}
      {isModalOpen ? (
        /* Formulario Integrado: Ocupa todo el apartado de forma independiente */
        <div className="px-6 py-6 bg-zinc-900 flex flex-col gap-6 animate-[fadeIn_0.2s_ease-out]">
          <div className="border-b border-zinc-600/80 pb-3">
            <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
              <Plus className="text-[#3b82f6]" size={18} />
              Crear Proyecto Formativo
            </h2>
            <p className="text-[13px] text-zinc-400 font-medium mt-0.5">
              Diligencie los campos requeridos para estructurar e inicializar el nuevo portafolio.
            </p>
          </div>

          <form onSubmit={handleCreate} className="space-y-5 max-w-full bg-zinc-900 p-6 rounded-md">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Nombre del proyecto">
                <input
                  name="nombre"
                  type="text"
                  required
                  placeholder="Ej: Sistema de control de inventario"
                  className="w-full bg-zinc-900 border border-zinc-600 rounded-md px-3 py-2 text-[13px] text-zinc-100 outline-none hover:bg-zinc-800 focus:bg-zinc-800 focus:border-blue-600 transition-colors placeholder-zinc-600"
                />
              </FormField>
              <FormField label="Ficha formativa">
                <select
                  name="fichaId"
                  required
                  onChange={e => setFormFichaId(Number(e.target.value) || null)}
                  className="w-full bg-zinc-900 border border-zinc-600 rounded-md px-3 py-2 text-[13px] text-zinc-300 outline-none hover:bg-zinc-800 focus:bg-zinc-800 focus:border-blue-600 transition-colors cursor-pointer"
                >
                  <option value="" className="text-zinc-500">Selecciona una ficha</option>
                  {fichasArr.map((f: any) => (
                    <option key={f.id} value={f.id} className="bg-zinc-900 text-zinc-300 hover:bg-zinc-800 focus:bg-zinc-800">
                      Ficha {f.codigo} - {f.programa}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13px]">
              <FormField label={formFichaId ? 'Líder técnico (de esta ficha)' : 'Líder técnico (Opcional)'}>
                <select
                  name="liderId"
                  className="w-full bg-zinc-900 border border-zinc-600 hover:bg-zinc-800 focus:bg-zinc-800 rounded-md px-3 py-2 text-[13px] text-zinc-300 outline-none focus:border-blue-600 transition-colors cursor-pointer"
                >
                  <option value="" className="text-zinc-500">
                    {formFichaId ? (formLeaders.length === 0 ? 'Sin líderes en esta ficha' : 'Asignar después') : 'Selecciona una ficha primero'}
                  </option>
                  {formLeaders.map((l: any) => (
                    <option key={l.id} value={l.id} className="bg-zinc-900 text-zinc-300">{l.nombre}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Estructura inicial temporal">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNumTrimestresNew(n => Math.max(1, n - 1))}
                    className="w-8 h-8 rounded-lg hover:bg-zinc-800 bg-zinc-950 border border-zinc-600 text-zinc-400 hover:text-white flex items-center justify-center font-bold text-[13px] select-none transition-colors active:scale-95"
                  >
                    -
                  </button>
                  <span className="w-12 text-[13px] font-black text-zinc-200 text-center tabular-nums">{numTrimestresNew}</span>
                  <button
                    type="button"
                    onClick={() => setNumTrimestresNew(n => Math.min(8, n + 1))}
                    className="w-8 h-8 rounded-lg hover:bg-zinc-800 bg-zinc-950 border border-zinc-600 text-zinc-400 hover:text-white flex items-center justify-center font-bold text-[13px] select-none transition-colors active:scale-95"
                  >
                    +
                  </button>
                </div>
                <p className="text-[13px] text-zinc-400 mt-1 italic leading-tight">
                  Cada bloque de trimestre se autogenerará con una duración estándar de 3 meses correlativos.
                </p>
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Competencia principal">
                <textarea
                  name="competencia"
                  required
                  rows={2}
                  placeholder="Escriba la competencia asociada..."
                  className="w-full bg-zinc-900 border hover:bg-zinc-800 focus:bg-zinc-800 border-zinc-600 rounded-md px-3 py-6 text-[13px] text-zinc-200 outline-none focus:border-blue-600 transition-colors resize-none placeholder-zinc-600"
                />
              </FormField>
              <FormField label="Resultado de aprendizaje">
                <textarea
                  name="resultado_aprendizaje"
                  required
                  rows={2}
                  placeholder="Escriba el resultado de aprendizaje..."
                  className="w-full bg-zinc-900 hover:bg-zinc-800 focus:bg-zinc-800 border border-zinc-600 rounded-md px-3 py-6 text-[13px] text-zinc-200 outline-none focus:border-blue-600 transition-colors resize-none placeholder-zinc-600"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Fecha de inicio de fase">
                <input
                  name="fecha_inicio"
                  type="date"
                  required
                  className="w-full bg-zinc-900 border border-zinc-600 rounded-md px-3 py-2 text-[13px] text-zinc-300 outline-none focus:border-blue-600 transition-colors"
                />
              </FormField>
              <FormField label="Fecha de finalización">
                <input
                  name="fecha_fin"
                  type="date"
                  required
                  className="w-full bg-zinc-900 border border-zinc-600 rounded-md px-3 py-2 text-[13px] text-zinc-300 outline-none focus:border-blue-600 transition-colors"
                />
              </FormField>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-zinc-600/60">
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setNumTrimestresNew(3);
                  setFormFichaId(null);
                }}
                className="px-4 py-2 text-[14px] font-bold text-zinc-400 hover:text-white transition-colors bg-transparent hover:bg-zinc-800 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-800 text-white text-[14px] font-black rounded-lg transition-all shadow-md active:scale-95"
              >
                {createMutation.isPending ? 'Creando...' : 'Crear e Inicializar'}
              </button>
            </div>
          </form>
        </div>
      ) : isBulkModalOpen ? (
        <div className="bg-zinc-900 flex flex-col gap-6 animate-[fadeIn_0.2s_ease-out]">
                    <div className="max-w-full bg-zinc-900 border border-zinc-600/80 p-6  shadow-xl">
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-md text-amber-300 flex gap-3 items-start mb-4">
              <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-lg font-bold text-white">Propagación estructural masiva</p>
                <p className="text-[13px] text-zinc-400 mt-0.5 leading-relaxed">
                  Esta acción generará nuevos trimestres para TODOS los {projects.length} proyectos activos en el sistema. Los módulos que no pertenezcan a ningún trimestre serán migrados automáticamente al primer trimestre creado.
                </p>
              </div>
            </div>
            <form onSubmit={hBulk(data => bulkMutation.mutate(data))} className="space-y-4">
              <FormField label="Cantidad de Trimestres:">
                <select
                  {...regBulk('num', { valueAsNumber: true })}
                  className="ml-5 bg-zinc-900 border border-zinc-600 rounded-md px-3 py-2 text-[13px] text-zinc-300 outline-none focus:border-blue-600 transition-colors cursor-pointer"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n} Trimestres</option>)}
                </select>
              </FormField>
              <div className="space-y-3 max-h-[980px] overflow-y-auto pr-2 custom-scrollbar">
                {fieldsBulk.map((field, index) => (
                  <div key={field.id} className="bg-zinc-950 border border-zinc-600/80 rounded-md p-4 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-black text-blue-400 uppercase tracking-wider">Trimestre {index + 1}</span>
                      <select
                        {...regBulk(`trimestres.${index}.tipo` as const)}
                        className="bg-zinc-900 border border-zinc-600 rounded-md px-2 py-1 text-[10px] font-bold text-zinc-400 outline-none cursor-pointer"
                      >
                        <option value="documental">Fase Documental</option>
                        <option value="desarrollo">Fase Desarrollo</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[13px] font-black text-zinc-500 uppercase tracking-tight">Fecha Inicio</label>
                        <input type="date" {...regBulk(`trimestres.${index}.fecha_inicio` as const)}
                          className="w-full bg-zinc-900 border border-zinc-600 rounded-md px-3 py-2 text-[12px] text-zinc-300 outline-none focus:border-blue-600 transition-colors" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[13px] font-black text-zinc-500 uppercase tracking-tight">Fecha Cierre</label>
                        <input type="date" {...regBulk(`trimestres.${index}.fecha_fin` as const)}
                          className="w-full bg-zinc-900 border border-zinc-600 rounded-md px-3 py-2 text-[12px] text-zinc-300 outline-none focus:border-blue-600 transition-colors" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-zinc-600/60">
                <button type="button" onClick={() => setIsBulkModalOpen(false)}
                  className="px-4 py-2 text-[12px] font-bold text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-zinc-800">
                  Cancelar
                </button>
                <button type="submit" disabled={bulkMutation.isPending}
                  className="px-5 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white text-[12px] font-black rounded-lg transition-all shadow-md active:scale-95">
                  {bulkMutation.isPending ? 'Propagando estructura...' : `Aplicar a ${projects.length} proyectos activos`}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        /* Vista de Listado Tradicional: Buscador, Filtros y Fichas */
        <>
          {/* Barra de Búsqueda y Filtros */}
          <div className="flex bg-zinc-900 flex-col pt-6 gap-4">
            <div className="relative mx-10">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar proyecto..."
                className="w-full bg-zinc-900 border border-zinc-400 rounded-lg pl-10 py-3.5 text-1xl text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-[#3b82f6] transition-all"
              />
            </div>

            {/* Segmentador de Estado / Filtros Rápidos */}
            <div className="flex mx-10 gap-6 p-1">
              {[
                { key: 'all', label: 'Todos' },
                { key: 'activo', label: 'Activos' },
                { key: 'pausado', label: 'En pausa' },
                { key: 'finalizado', label: 'Finalizados' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  className={`px-3 py-1 rounded-md border border-zinc-600 font-bold transition-all ${statusFilter === key
                    ? 'hover:bg-zinc-500 text-zinc-300 shadow-sm bg-zinc-800'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Controles Secundarios / Metadatos */}
          <div className="px-10 pt-10 pb-2.5 bg-zinc-900 flex items-center justify-between text-lg font-bold text-zinc-300 shrink-0">
            <div className="flex items-center gap-1.5">
              <span>Hay <strong className="text-zinc-300 font-bold">{filteredProjects.length}</strong> proyectos</span>
            </div>
          </div>

          {/* Contenido Principal */}
          <div className="pb-12">
            {isLoading ? (
              <div className="space-y-3 px-10">
                {[1, 2, 3].map(n => <div key={n} className="h-16 bg-zinc-900 border border-zinc-600/40 rounded-md animate-pulse" />)}
              </div>
            ) : showFichaView ? (
              // ── Vista por fichas (Coordinador / Instructor) ───────────────────
              <div className="space-y-1 mx-4 bg-zinc-900">
                {fichaGroups.byFicha.length === 0 && fichaGroups.sinFicha.length === 0 ? (
                  <div className="py-12 text-center text-[12px] font-medium text-zinc-500 italic bg-zinc-900 border border-zinc-600/60 rounded-md">
                    No se encontraron proyectos correspondientes a los filtros aplicados.
                  </div>
                ) : (
                  <>
                    {fichaGroups.byFicha.map((g: any) => (
                      <FichaProjectBlock
                        key={g.ficha.id}
                        ficha={g.ficha}
                        projects={g.projects}
                        canCreate={canCreate}
                        isCoordinador={isCoordinador}
                        search={search}
                        onDelete={(p: any) => setDeleteTarget({ id: p.id, nombre: p.nombre })}
                        updateStatusMutation={updateStatusMutation}
                        navigate={navigate}
                        queryClient={queryClient}
                      />
                    ))}

                    {fichaGroups.sinFicha.length > 0 && (
                      <div className="bg-zinc-900/95 border border-zinc-600/80 rounded-md overflow-hidden shadow-lg mb-4">
                        <div className="px-5 py-4 bg-zinc-950/20 border-b border-zinc-600/40">
                          <p className="text-sm font-black text-white tracking-tight">Proyectos sin Ficha Asignada</p>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-zinc-600 bg-zinc-950/40">
                                <th className="px-6 py-3 text-[10px] uppercase tracking-[0.15em] font-black text-zinc-400">Proyecto</th>
                                <th className="px-6 py-3 text-[10px] uppercase tracking-[0.15em] font-black text-zinc-400">Estado</th>
                                <th className="px-6 py-3 text-[10px] uppercase tracking-[0.15em] font-black text-zinc-400">Líder</th>
                                <th className="px-6 py-3 text-[10px] uppercase tracking-[0.15em] font-black text-zinc-400">Fechas</th>
                                <th className="px-6 py-3 text-[10px] uppercase tracking-[0.15em] font-black text-zinc-400 text-right">Acciones</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/40 font-medium text-[12px]">
                              {fichaGroups.sinFicha
                                .filter((proj: any) => !search || proj.nombre?.toLowerCase().includes(search.toLowerCase()))
                                .map((proj: any) => (
                                  <ProjectRow
                                    key={proj.id}
                                    proj={proj}
                                    canCreate={canCreate}
                                    isCoordinador={isCoordinador}
                                    onDelete={(p: any) => setDeleteTarget({ id: p.id, nombre: p.nombre })}
                                    updateStatusMutation={updateStatusMutation}
                                    navigate={navigate}
                                    leaders={leaders}
                                    queryClient={queryClient}
                                  />
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              // ── Vista plana (Aprendiz / Líder Técnico) ─────────────────────────
              <div className="bg-zinc-900 border border-zinc-700/60 rounded-md mx-4 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-600 bg-zinc-950/40 sticky top-0 z-10">
                        <th className="px-6 py-4 text-[11px] uppercase tracking-[0.15em] font-black text-zinc-400">Nombre</th>
                        <th className="px-6 py-4 text-[11px] uppercase tracking-[0.15em] font-black text-zinc-400">Ficha</th>
                        <th className="px-6 py-4 text-[11px] uppercase tracking-[0.15em] font-black text-zinc-400">Estado</th>
                        <th className="px-6 py-4 text-[11px] uppercase tracking-[0.15em] font-black text-zinc-400">Líder</th>
                        <th className="px-6 py-4 text-[11px] uppercase tracking-[0.15em] font-black text-zinc-400">Fechas</th>
                        <th className="px-6 py-4 text-[11px] uppercase tracking-[0.15em] font-black text-zinc-400 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 font-medium text-[12px]">
                      {filteredProjects.filter(proj => !search || proj.nombre?.toLowerCase().includes(search.toLowerCase())).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-16">
                            <AlertCircle size={26} className="mx-auto text-zinc-600 mb-2 opacity-40" />
                            <p className="text-sm font-medium text-zinc-500">
                              {esAprendiz ? 'Tu instructor aún no te ha asignado a un proyecto institucional.' : 'No se encontraron proyectos vinculados.'}
                            </p>
                          </td>
                        </tr>
                      ) : (
                        filteredProjects
                          .filter(proj => !search || proj.nombre?.toLowerCase().includes(search.toLowerCase()))
                          .map((proj: any) => {
                            const sc = STATUS_CONFIG[proj.estado as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.activo;
                            return (
                              <tr key={proj.id} className="hover:bg-zinc-800/30 transition-colors group border-b border-zinc-600/40">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-md bg-zinc-950 border border-zinc-600 flex items-center justify-center font-bold text-[#3b82f6] text-[11px] shadow-inner group-hover:border-[#3b82f6]/40 transition-colors shrink-0">
                                      <FolderKanban size={13} className="text-[#3b82f6]" />
                                    </div>
                                    <div>
                                      <span
                                        onClick={() => navigate(`/projects/${proj.id}`)}
                                        className="text-white font-bold tracking-tight text-sm group-hover:text-[#3b82f6] transition-colors cursor-pointer"
                                      >
                                        {proj.nombre}
                                      </span>
                                      <div className="text-[10px] text-zinc-500 font-normal line-clamp-1">{proj.descripcion}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-zinc-300 font-semibold">
                                  {proj.ficha ? `Ficha {proj.ficha.codigo}` : <span className="text-zinc-500 italic">Sin ficha</span>}
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`rounded-md px-2.5 py-1 text-[10px] uppercase font-black tracking-wider border ${sc.badge}`}>
                                    {sc.label}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  {proj.lider ? (
                                    <div className="flex items-center gap-1.5">
                                      <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                        <span className="text-[8px] font-bold text-emerald-400">{proj.lider.nombre?.slice(0, 2).toUpperCase()}</span>
                                      </div>
                                      <span className="text-[12px] font-semibold text-zinc-300">{proj.lider.nombre}</span>
                                    </div>
                                  ) : (
                                    <span className="text-[12px] text-zinc-500 italic">Sin asignar</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-zinc-400 tabular-nums">
                                  {proj.fecha_inicio} <span className="text-zinc-600">→</span> {proj.fecha_fin}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => navigate(`/projects/${proj.id}`)}
                                      className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-md text-[12px] font-bold border border-zinc-600 transition-all active:scale-95"
                                    >
                                      <LayoutGrid size={16} /> Tablero
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal confirmación eliminar */}
      <Modal isOpen={deleteTarget !== null} onClose={() => { setDeleteTarget(null); setDeleteError(null); }} title="Eliminar proyecto">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-md text-rose-300">
            <AlertTriangle size={18} className="text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-white">
                ¿Estás seguro de que deseas eliminar <span className="text-rose-400">"{deleteTarget?.nombre}"</span>?
              </p>
              <p className="text-[12px] text-zinc-400 mt-1 leading-relaxed">
                Se eliminarán permanentemente todos sus tickets, sprints y comentarios vinculados. Esta operación destruirá la información de manera irreversible.
              </p>
            </div>
          </div>
          {deleteError && (
            <div className="flex items-center gap-2 p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg">
              <AlertCircle size={14} className="text-rose-400 shrink-0" />
              <p className="text-[12px] text-rose-400 font-medium">{deleteError}</p>
            </div>
          )}
          <div className="flex gap-2 justify-end pt-2">
            <button
              onClick={() => { setDeleteTarget(null); setDeleteError(null); }}
              className="px-4 py-2 text-[12px] font-bold text-zinc-400 hover:text-white transition-colors bg-transparent hover:bg-zinc-800 rounded-lg"
              disabled={deleteMutation.isPending}
            >
              Cancelar
            </button>
            <button
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              className="px-4 py-2 text-[12px] font-black bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-all"
            >
              {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar permanentemente'}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
};