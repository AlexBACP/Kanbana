import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, FolderKanban, ChevronRight } from 'lucide-react';
import { projectService } from '../services/project.service';
import { fichaService } from '../services/ficha.service';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { useState } from 'react';
import { Modal } from '../components/Modal';
import { useForm } from 'react-hook-form';
import { CreateProjectDto } from '../types/project.types';
import { useAuthStore } from '../store/auth.store';

export const ProjectsPage = () => {
  const { user } = useAuthStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm] = useState('');
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectService.getAll(),
  });

  const { data: fichas = [] } = useQuery({
    queryKey: ['fichas'],
    queryFn: () => fichaService.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: (dto: any) => projectService.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsModalOpen(false);
      reset();
    },
  });

  const { register, handleSubmit, reset } = useForm<CreateProjectDto>();

  const isAdmin = user?.rol === 'coordinador' || user?.rol === 'instructor';

  const onSubmit = (data: CreateProjectDto) => {
    createMutation.mutate({
      ...data,
      ficha_id: Number(data.ficha_id)
    });
  };

  const filteredProjects = projects.filter((p: any) => 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.descripcion.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = [
    { label: 'Total', value: projects.length },
    { label: 'Activos', value: projects.filter((project: any) => project.estado === 'activo').length },
  ];

  return (
    <div className="space-y-10 animate-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 px-2">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-dark-text tracking-tight">Proyectos</h1>
          <p className="text-dark-muted font-bold">Gestiona y supervisa tus fichas ADSO</p>
        </div>
        {isAdmin && (
          <Button 
            onClick={() => setIsModalOpen(true)} 
            className="flex items-center gap-3 px-6 py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-primary-500/20 transition-all active:scale-95"
          >
            <Plus size={20} />
            Nuevo Proyecto
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-dark-card rounded-[2.5rem] border border-dark-border animate-pulse" />
          ))}
        </div>
      ) : filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProjects.map((project: any) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}/kanban`}
              className="group bg-dark-card rounded-[2.5rem] border border-dark-border p-8 shadow-2xl hover:shadow-primary-500/5 hover:border-primary-500/30 transition-all duration-500 flex flex-col relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                <FolderKanban size={120} />
              </div>

              <div className="flex items-center justify-between mb-8">
                <div className="w-14 h-14 bg-primary-600/10 text-primary-400 rounded-2xl flex items-center justify-center font-black text-2xl border border-primary-500/20 shadow-lg shadow-primary-500/5 group-hover:scale-110 transition-transform duration-500">
                  {project.nombre.charAt(0)}
                </div>
                <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border shadow-sm ${
                  project.estado === 'activo' 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}>
                  {project.estado || 'Activo'}
                </div>
              </div>

              <div className="flex-1 space-y-3">
                <h3 className="text-xl font-black text-dark-text group-hover:text-primary-400 transition-colors tracking-tight leading-tight">
                  {project.nombre}
                </h3>
                <p className="text-sm text-dark-muted font-medium line-clamp-2 opacity-80 leading-relaxed">
                  {project.descripcion}
                </p>
              </div>

              <div className="mt-8 pt-6 border-t border-dark-border flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-dark-muted uppercase tracking-widest opacity-60">Ficha</span>
                  <span className="text-xs font-bold text-dark-text">{project.ficha?.codigo || 'N/A'}</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-dark-bg border border-dark-border flex items-center justify-center text-dark-muted group-hover:text-primary-400 group-hover:border-primary-500/30 transition-all">
                  <ChevronRight size={18} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-dark-card border border-dark-border rounded-[3rem] p-20 text-center shadow-2xl">
          <div className="w-24 h-24 bg-dark-bg rounded-3xl flex items-center justify-center text-dark-muted mx-auto mb-8 border border-dark-border shadow-inner">
            <FolderKanban size={48} />
          </div>
          <h3 className="text-2xl font-black text-dark-text mb-3">No hay proyectos</h3>
          <p className="text-dark-muted font-bold max-w-sm mx-auto opacity-70">
            Comienza creando tu primer proyecto para gestionar las tareas de tu ficha.
          </p>
          {isAdmin && (
            <Button onClick={() => setIsModalOpen(true)} className="mt-10 px-8 py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-primary-500/20 transition-all active:scale-95">
              Crear mi primer proyecto
            </Button>
          )}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Crear Nuevo Proyecto">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 p-2">
          <div className="space-y-2">
            <label className="block text-xs font-black text-dark-muted uppercase tracking-widest ml-1">Nombre del Proyecto</label>
            <input
              {...register('nombre', { required: true })}
              className="w-full px-5 py-4 bg-dark-bg/50 border border-dark-border rounded-2xl text-sm text-dark-text outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all placeholder:text-dark-muted/30"
              placeholder="Ej: Sistema de Gestión de Inventarios"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-black text-dark-muted uppercase tracking-widest ml-1">Descripción</label>
            <textarea
              {...register('descripcion', { required: true })}
              rows={3}
              className="w-full px-5 py-4 bg-dark-bg/50 border border-dark-border rounded-2xl text-sm text-dark-text outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all placeholder:text-dark-muted/30 resize-none"
              placeholder="Breve descripción del objetivo del proyecto..."
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-muted uppercase tracking-widest ml-1">Ficha SENA</label>
              <select
                {...register('ficha_id', { required: true })}
                className="w-full px-5 py-4 bg-dark-bg/50 border border-dark-border rounded-2xl text-sm text-dark-text outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all"
              >
                <option value="">Seleccionar Ficha</option>
                {fichas.map(f => (
                  <option key={f.id} value={f.id}>{f.codigo} - {f.programa}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-muted uppercase tracking-widest ml-1">Competencia</label>
              <input
                {...register('competencia', { required: true })}
                className="w-full px-5 py-4 bg-dark-bg/50 border border-dark-border rounded-2xl text-sm text-dark-text outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all placeholder:text-dark-muted/30"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-muted uppercase tracking-widest ml-1">Fecha Inicio</label>
              <input
                type="date"
                {...register('fecha_inicio', { required: true })}
                className="w-full px-5 py-4 bg-dark-bg/50 border border-dark-border rounded-2xl text-sm text-dark-text outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-black text-dark-muted uppercase tracking-widest ml-1">Fecha Fin</label>
              <input
                type="date"
                {...register('fecha_fin', { required: true })}
                className="w-full px-5 py-4 bg-dark-bg/50 border border-dark-border rounded-2xl text-sm text-dark-text outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all"
              />
            </div>
          </div>
          <div className="flex justify-end gap-4 pt-4">
            <Button 
              variant="secondary" 
              onClick={() => setIsModalOpen(false)}
              className="px-6 py-4 bg-dark-bg border border-dark-border text-dark-text hover:bg-dark-border transition-all rounded-2xl font-black text-sm"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              isLoading={createMutation.isPending}
              className="px-8 py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-primary-500/20 transition-all"
            >
              Crear Proyecto
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};