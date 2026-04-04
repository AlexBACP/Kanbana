/**
 * FichasPanel — Navegación jerárquica de 3 niveles:
 * Nivel 1: Lista de Fichas (Filtrada por rol)
 * Nivel 2: Detalle de Ficha (Proyectos)
 * Nivel 3: Detalle de Proyecto (Kanban, Miembros, Tickets)
 * FormField
 */
import React, { useState, useCallback, useMemo } from 'react'; // ✅ CAMBIO: Añadir 'React' al import
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, ChevronRight, ChevronLeft, Hash, Calendar,
  GraduationCap, FolderKanban, Users, User as UserIcon, ShieldCheck,
  Ticket, LayoutGrid, CheckCircle2, Clock, AlertCircle,
  BookOpen, ExternalLink, UserPlus
} from 'lucide-react';

import { fichaService } from '../../services/ficha.service';
import { projectService } from '../../services/project.service';
import { ticketService } from '../../services/ticket.service';
import { userService } from '../../services/user.service';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { useAuthStore } from '../../store/auth.store';

const FormField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-dark-muted uppercase tracking-widest ml-1">
      {label}
    </label>
    {children}
  </div>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────
type Level = 'fichas' | 'ficha' | 'proyecto';

const STATUS_COLORS: Record<string, string> = {
  activo: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  pausado: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  finalizado: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

const Chip = ({ label, color }: { label: string; color: string }) => (
  <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border uppercase tracking-widest ${color}`}>{label}</span>
);

const Avatar = ({ nombre, url, size = 8 }: { nombre?: string; url?: string; size?: number }) => (
  <div className={`w-${size} h-${size} rounded-xl bg-gradient-to-br from-primary-600 to-indigo-700 flex items-center justify-center overflow-hidden border border-white/10 shrink-0`}>
    {url ? <img src={url} className="w-full h-full object-cover" alt="" /> : (
      <span className="text-white font-black text-xs">{nombre?.slice(0, 2).toUpperCase() || 'KA'}</span>
    )}
  </div>
);

const SkeletonCard = () => (
  <div className="h-40 bg-dark-card/50 rounded-[2rem] animate-pulse border border-dark-border" />
);

// ─── Level 3: Proyecto Detalle (Compartido) ───────────────────────────────────
const ProyectoDetalle = ({
  proyectoId, onBack,
}: { proyectoId: number; onBack: () => void }) => {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);

  const { data: proyecto, isLoading } = useQuery({
    queryKey: ['projects', proyectoId],
    queryFn: () => projectService.getById(proyectoId),
    staleTime: 1000 * 60,
  });

  const { data: miembros = [] } = useQuery({
    queryKey: ['projects', proyectoId, 'members'],
    queryFn: () => projectService.getMembers(proyectoId),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => userService.getAll(),
    enabled: showMemberModal,
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ['tickets', { proyectoId }],
    queryFn: () => ticketService.getAll(proyectoId),
  });

  const createTicketMutation = useMutation({
    mutationFn: (dto: any) => ticketService.create({ ...dto, proyecto_id: proyectoId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets', { proyectoId }] });
      setShowTicketModal(false);
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: (userId: number) => projectService.addMember(proyectoId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', proyectoId, 'members'] });
      setShowMemberModal(false);
    },
  });

  if (isLoading) return <div className="space-y-4"><SkeletonCard /></div>;
  if (!proyecto) return null;

  const ticketsArr = tickets as any[];
  const done = ticketsArr.filter(t => t.estado === 'done').length;
  const progress = ticketsArr.length ? Math.round((done / ticketsArr.length) * 100) : 0;
  const canManage = user?.rol === 'coordinador' || user?.rol === 'instructor' || user?.rol === 'lider_tecnico';

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-dark-muted hover:text-primary-400 text-xs font-black uppercase tracking-widest">
        <ChevronLeft size={14} /> Volver a la Ficha
      </button>

      <div className="bg-dark-card border border-dark-border rounded-[2rem] p-6">
        <Chip label={proyecto.estado} color={STATUS_COLORS[proyecto.estado] || STATUS_COLORS.activo} />
        <h2 className="text-2xl font-black text-white uppercase mt-2">{proyecto.nombre}</h2>
        <p className="text-dark-muted text-sm mt-1">{proyecto.descripcion}</p>

        <div className="mt-6">
          <div className="flex justify-between mb-2"><span className="text-[10px] font-black text-dark-muted uppercase">Progreso Global</span><span className="text-xs font-black text-primary-400">{progress}%</span></div>
          <div className="h-2 bg-dark-bg rounded-full overflow-hidden">
            <div className="h-full bg-primary-500 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* Botón para ir al Kanban */}
      <div className="flex justify-center">
        <a href={`/projects/${proyecto.id}/kanban`} className="px-8 py-3 bg-primary-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-primary-500 transition-all">
          Ir al Tablero Kanban
        </a>
      </div>
    </motion.div>
  );
};

// ─── Level 2: Ficha Detalle ───────────────────────────────────────────────────
const FichaDetalle = ({
  fichaId, onBack, onSelectProyecto,
}: { fichaId: number; onBack: () => void; onSelectProyecto: (id: number) => void }) => {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  const { data: ficha, isLoading: loadingFicha } = useQuery({
    queryKey: ['fichas', fichaId],
    queryFn: () => fichaService.getById(fichaId),
  });

  const { data: proyectos = [], isLoading: loadingProyectos } = useQuery({
    queryKey: ['projects', { fichaId }],
    queryFn: () => projectService.getAll({ fichaId }),
  });

  const { data: instructores = [] } = useQuery({
    queryKey: ['users', 'instructors'],
    queryFn: () => userService.getAll(),
    select: (data: any) => (data as any[]).filter(u => u.rol === 'instructor'),
    enabled: showModal,
  });

  const createProyectoMutation = useMutation({
    mutationFn: (dto: any) => projectService.create({ ...dto, fichaId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', { fichaId }] });
      setShowModal(false);
    },
  });

  if (loadingFicha) return <div className="space-y-4"><SkeletonCard /></div>;
  if (!ficha) return null;

  const canCreate = user?.rol === 'coordinador' || user?.rol === 'instructor';
  const FormField = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-dark-muted uppercase tracking-widest ml-1">{label}</label>
      {children}
    </div>
  );
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-dark-muted hover:text-primary-400 text-xs font-black uppercase tracking-widest">
        <ChevronLeft size={14} /> Todas las Fichas
      </button>

      <div className="bg-dark-card border border-dark-border rounded-[2rem] p-6">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 text-primary-400 text-xs font-bold mb-1"><Hash size={12} /> Ficha {ficha.codigo}</div>
            <h2 className="text-2xl font-black text-white uppercase">{ficha.programa}</h2>
          </div>
          {canCreate && (
            <Button onClick={() => setShowModal(true)}><Plus size={14} /> Nuevo Proyecto</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(proyectos as any[]).map((p: any) => (
          <button key={p.id} onClick={() => onSelectProyecto(p.id)} className="bg-dark-card p-5 rounded-[2rem] border border-dark-border hover:border-primary-500/40 text-left transition-all group">
            <FolderKanban size={20} className="text-primary-400 mb-3" />
            <h4 className="font-black text-white group-hover:text-primary-400 transition-colors uppercase tracking-tight">{p.nombre}</h4>
            <div className="mt-2"><Chip label={p.estado} color={STATUS_COLORS[p.estado] || STATUS_COLORS.activo} /></div>
          </button>
        ))}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nuevo Proyecto Formativo">
        <form onSubmit={e => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          createProyectoMutation.mutate({
            nombre: f.get('nombre'),
            descripcion: f.get('descripcion'),
            instructorId: Number(f.get('instructorId')) || undefined,
            fecha_inicio: f.get('fecha_inicio'),
            fecha_fin: f.get('fecha_fin'),
          });
        }} className="space-y-5">
          <FormField label="Nombre del Proyecto"><input name="nombre" required className="input-dark" /></FormField>
          <FormField label="Instructor Responsable">
            <select name="instructorId" className="input-dark">
              <option value="">Sin asignar</option>
              {(instructores as any[]).map((i: any) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
            </select>
          </FormField>
          <Button type="submit" isLoading={createProyectoMutation.isPending} className="w-full">Crear Proyecto</Button>
        </form>
      </Modal>
    </motion.div>
  );
};

// ─── Level 1: Fichas List (FILTRADO POR ROL) ──────────────────────────────────
export const FichasPanel = () => {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [level, setLevel] = useState<Level>('fichas');
  const [selectedFichaId, setSelectedFichaId] = useState<number | null>(null);
  const [selectedProyectoId, setSelectedProyectoId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);

  // 1. Cargamos todas las fichas
  const { data: fichas = [], isLoading } = useQuery({
    queryKey: ['fichas'],
    queryFn: () => fichaService.getAll(),
    staleTime: 1000 * 60,
  });

  // 2. Cargamos instructores para el modal de creación (solo para coordinador)
  const { data: users = [] } = useQuery({
    queryKey: ['users', 'instructors-list'],
    queryFn: () => userService.getAll(),
    enabled: user?.rol === 'coordinador',
  });

  const instructors = (users as any[]).filter(u => u.rol === 'instructor');

  // ⚡ CAMBIO: Lógica de filtrado por rol aplicada aquí.
  // MOTIVO: Para que el instructor no vea fichas ajenas y el coordinador mantenga la visión global.
  const displayedFichas = useMemo(() => {
    if (!user) return [];
    const all = fichas as any[];

    if (user.rol === 'instructor') {
      // CAMBIO: Filtro estricto por ID de instructor.
      return all.filter(f => f.instructor_id === user.id || f.instructor?.id === user.id);
    }

    return all;
  }, [fichas, user]);

  const createMutation = useMutation({
    mutationFn: (dto: any) => fichaService.create(dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fichas'] }); setShowModal(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fichaService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fichas'] }),
  });

  const isCoordinador = user?.rol === 'coordinador';

  if (level === 'proyecto' && selectedProyectoId) {
    return <ProyectoDetalle proyectoId={selectedProyectoId} onBack={() => setLevel('ficha')} />;
  }

  if (level === 'ficha' && selectedFichaId) {
    return <FichaDetalle fichaId={selectedFichaId} onBack={() => setLevel('fichas')} onSelectProyecto={(id) => { setSelectedProyectoId(id); setLevel('proyecto'); }} />;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-dark-card/30 p-6 rounded-[2rem] border border-dark-border">
        <div>
          {/* CAMBIO: Título dinámico según el rol */}
          <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
            {isCoordinador ? 'Panel de Coordinación' : 'Mis Fichas Asignadas'}
          </h2>
          {/* CAMBIO: Subtítulo personalizado para mejorar la experiencia de usuario (UX) */}
          <p className="text-dark-muted text-sm font-bold mt-1">
            {isCoordinador ? 'Gestión total de grupos ADSO e Instructores' : `Hola ${user?.nombre}, aquí están tus fichas de formación.`}
          </p>
        </div>
        {isCoordinador && (
          <Button onClick={() => setShowModal(true)} className="flex items-center gap-2"><Plus size={15} /> Nueva Ficha</Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {isLoading ? (
          [1, 2, 3].map(n => <SkeletonCard key={n} />)
        ) : displayedFichas.length === 0 ? (
          // CAMBIO: Empty state mejorado. 
          // MOTIVO: Avisar visualmente si un instructor no tiene nada asignado aún.
          <div className="col-span-full py-20 text-center bg-dark-card/10 rounded-[2.5rem] border border-dashed border-dark-border">
            <GraduationCap size={40} className="mx-auto text-dark-muted mb-4 opacity-20" />
            <p className="text-dark-muted font-black uppercase tracking-widest">No hay fichas para mostrar</p>
          </div>
        ) : (
          displayedFichas.map((f: any) => (
            <motion.div
              key={f.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => { setSelectedFichaId(f.id); setLevel('ficha'); }}
              className="bg-dark-card rounded-[2.5rem] border border-dark-border hover:border-primary-500/40 transition-all group cursor-pointer overflow-hidden"
            >
              <div className="h-1.5 bg-gradient-to-r from-primary-600 to-indigo-600 opacity-60" />
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-primary-500/10 rounded-2xl text-primary-400 group-hover:scale-110 transition-transform">
                    <GraduationCap size={20} />
                  </div>
                  {isCoordinador && (
                    <button onClick={e => { e.stopPropagation(); if (confirm('¿Eliminar ficha?')) deleteMutation.mutate(f.id); }} className="p-2 text-dark-muted hover:text-rose-500">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <h3 className="font-black text-base text-white uppercase tracking-tight group-hover:text-primary-400 mb-4 line-clamp-2">{f.programa}</h3>

                <div className="flex flex-col gap-2 pt-4 border-t border-dark-border/50">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-primary-400 bg-primary-500/10 px-2 py-0.5 rounded-lg border border-primary-500/20">#{f.codigo}</span>
                  </div>

                  {/* ✅ CAMBIO: Muestra el nombre del instructor en la Card. */}
                  {/* MOTIVO: Permite al coordinador identificar rápidamente quién es el responsable de cada grupo. */}
                  <div className="flex items-center gap-2 mt-1">
                    <UserIcon size={12} className="text-indigo-400" />
                    <span className="text-[11px] font-black text-dark-muted uppercase tracking-wider">
                      {f.instructor ? `INS: ${f.instructor.nombre}` : '⚠️ SIN INSTRUCTOR'}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nueva Ficha de Formación">
        <form onSubmit={e => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          createMutation.mutate({
            codigo: f.get('codigo'),
            programa: f.get('programa'),
            fecha_inicio: f.get('fecha_inicio'),
            fecha_fin: f.get('fecha_fin'),
            instructor_id: f.get('instructor_id'),
          });
        }} className="space-y-5">
          <FormField label="Código de la Ficha"><input name="codigo" required className="input-dark" placeholder="2670687" /></FormField>
          <FormField label="Programa de Formación"><input name="programa" required className="input-dark" placeholder="ADSO" /></FormField>

          {/* CAMBIO: Label de selección más específico */}
          <FormField label="Asignar Instructor Responsable">
            <select name="instructor_id" required className="input-dark">
              <option value="">Selecciona quién estará a cargo</option>
              {instructors.map((ins: any) => <option key={ins.id} value={ins.id}>{ins.nombre}</option>)}
            </select>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Fecha Inicio"><input name="fecha_inicio" type="date" required className="input-dark" /></FormField>
            <FormField label="Fecha Fin"><input name="fecha_fin" type="date" required className="input-dark" /></FormField>
          </div>
          <Button type="submit" isLoading={createMutation.isPending} className="w-full py-4 font-black uppercase">Guardar Ficha</Button>
        </form>
      </Modal>
    </div>

  );

};