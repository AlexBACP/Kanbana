// src/pages/dashboard/ProjectsPanel.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectService } from '../../services/project.service';
import { userService } from '../../services/user.service';
import { fichaService } from '../../services/ficha.service';
import { useAuthStore } from '../../store/auth.store';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { useState } from 'react';
import {
  Search, Plus, Trash2, FolderKanban,
  ExternalLink, Edit3, Filter, AlertCircle, GraduationCap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const STATUS_CONFIG = {
  activo: { label: 'Activo', class: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' },
  pausado: { label: 'En pausa', class: 'bg-amber-500/10 border-amber-500/30 text-amber-400' },
  finalizado: { label: 'Finalizado', class: 'bg-rose-500/10 border-rose-500/30 text-rose-400' },
};

export const ProjectsPanel = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  // --- QUERIES ---
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectService.getAll,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: userService.getAll,
  });

  const { data: fichas = [] } = useQuery({
    queryKey: ['fichas'],
    queryFn: fichaService.getAll,
  });

  const leaders = (users as any[]).filter((u: any) => u.rol === 'lider_tecnico');

  // --- MUTATIONS ---
  const deleteMutation = useMutation({
    mutationFn: projectService.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });

  const createMutation = useMutation({
    mutationFn: projectService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsModalOpen(false);
    },
  });

  const handleUpdateStatus = (id: number, estado: any) => {
    projectService.updateStatus(id, estado).then(() => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    });
  };

  const handleCreateProject = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    
    createMutation.mutate({
      nombre: f.get('nombre') as string,
      descripcion: f.get('descripcion') as string,
      liderId: Number(f.get('liderId')),
      fichaId: Number(f.get('fichaId')),
      instructorId: user?.id,
      competencia: f.get('competencia') as string,
      resultado_aprendizaje: f.get('resultado_aprendizaje') as string,
      fecha_inicio: f.get('fecha_inicio') as string,
      fecha_fin: f.get('fecha_fin') as string,
    } as any);
  };

  const filtered = (projects as any[]).filter(p => {
    const matchSearch = p.nombre?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.estado === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalActivos = (projects as any[]).filter(p => p.estado === 'activo').length;
  const totalPausa = (projects as any[]).filter(p => p.estado === 'pausado').length;

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex flex-col xl:flex-row justify-between gap-6 bg-dark-card/30 p-6 rounded-[2rem] border border-dark-border">
        <div>
          <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
            Celdas de Desarrollo
          </h2>
          <p className="text-dark-muted text-sm font-bold mt-1">Gestión técnica de proyectos ADSO</p>
          <div className="flex gap-4 mt-3">
            <Chip label={`${totalActivos} Activos`} color="emerald" />
            <Chip label={`${totalPausa} En pausa`} color="amber" />
            <Chip label={`${(projects as any[]).length} Total`} color="blue" />
          </div>
        </div>

        <div className="flex gap-3 flex-wrap items-center">
          <div className="relative group">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-muted group-focus-within:text-primary-500 transition-colors" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar proyecto..."
              className="pl-11 pr-5 py-3 rounded-2xl bg-dark-bg border border-dark-border focus:border-primary-500 outline-none text-white text-sm w-56 transition-all"
            />
          </div>

          <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
            <Plus size={16} /> Nueva Celda
          </Button>
        </div>
      </div>

      {/* GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {isLoading ? (
          [1, 2, 3].map(n => <div key={n} className="h-64 bg-dark-card/50 rounded-[2.5rem] animate-pulse border border-dark-border" />)
        ) : (
          <AnimatePresence>
            {filtered.map((p, index) => {
              const statusConf = STATUS_CONFIG[p.estado as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.activo;
              return (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-dark-card p-6 rounded-[2.5rem] border border-dark-border hover:border-primary-500/40 transition-all group flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-primary-500/10 rounded-2xl text-primary-500">
                        <FolderKanban size={22} />
                      </div>
                      <button onClick={() => deleteMutation.mutate(p.id)} className="text-dark-muted hover:text-rose-500 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <h3 className="font-black text-lg text-white uppercase tracking-tight">{p.nombre}</h3>
                    <p className="text-xs text-dark-muted italic mb-3 line-clamp-1">{p.descripcion}</p>
                    
                    <div className="flex items-center gap-2 text-[10px] font-bold text-primary-400 bg-primary-500/5 py-1 px-2 rounded-lg w-fit">
                      <GraduationCap size={12} /> Ficha: {p.ficha?.codigo || 'Sin ficha'}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <select
                      value={p.estado}
                      onChange={(e) => handleUpdateStatus(p.id, e.target.value)}
                      className={`text-[10px] font-black uppercase px-3 py-2 rounded-xl border w-full cursor-pointer outline-none ${statusConf.class}`}
                    >
                      <option value="activo">Activo</option>
                      <option value="pausado">En pausa</option>
                      <option value="finalizado">Finalizado</option>
                    </select>

                    <div className="flex justify-between items-center pt-3 border-t border-dark-border/50">
                      <button className="flex items-center gap-1.5 text-[10px] font-black text-primary-400 uppercase tracking-widest">
                        <ExternalLink size={13} /> Tablero
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* MODAL */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nueva Celda de Desarrollo">
        <form onSubmit={handleCreateProject} className="space-y-5">
          <FormField label="Nombre del Proyecto">
            <input name="nombre" required placeholder="Ej: Sistema de Inventarios SENA" className="input-dark" />
          </FormField>
          
          <FormField label="Descripción General">
            <textarea name="descripcion" required rows={2} className="input-dark resize-none" />
          </FormField>

          <FormField label="Ficha del Programa">
            <select name="fichaId" required className="input-dark">
              <option value="">Selecciona la ficha...</option>
              {fichas.map((f: any) => (
                <option key={f.id} value={f.id}>{f.codigo} - {f.nombre}</option>
              ))}
            </select>
          </FormField>

          <div className="grid grid-cols-1 gap-4">
            <FormField label="Competencia a Evaluar">
              <textarea name="competencia" required rows={2} className="input-dark text-xs" />
            </FormField>
            <FormField label="Resultado de Aprendizaje (RAP)">
              <textarea name="resultado_aprendizaje" required rows={2} className="input-dark text-xs" />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Fecha de Inicio">
              <input name="fecha_inicio" type="date" required className="input-dark" />
            </FormField>
            <FormField label="Fecha de Fin">
              <input name="fecha_fin" type="date" required className="input-dark" />
            </FormField>
          </div>

          <FormField label="Asignar Líder Técnico">
            <select name="liderId" required className="input-dark">
              <option value="">Selecciona un responsable...</option>
              {leaders.map((l: any) => (
                <option key={l.id} value={l.id}>{l.nombre}</option>
              ))}
            </select>
          </FormField>

          <Button type="submit" isLoading={createMutation.isPending} className="w-full py-4 bg-primary-600">
            {createMutation.isPending ? 'Creando...' : 'Crear Proyecto Formativo'}
          </Button>
        </form>
      </Modal>
    </div>
  );
};

// --- SUBCOMPONENTES (Faltaban en la versión anterior) ---

const Chip = ({ label, color }: { label: string; color: string }) => {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  };
  return (
    <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-widest ${colors[color]}`}>
      {label}
    </span>
  );
};

const FormField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-dark-muted uppercase tracking-widest ml-1">{label}</label>
    {children}
  </div>
);