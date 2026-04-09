import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectService } from '../../services/project.service';
import { userService } from '../../services/user.service';
import { fichaService } from '../../services/ficha.service';
import { useAuthStore } from '../../store/auth.store';
import { Modal } from '../../components/Modal';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Trash2, FolderKanban, LayoutGrid, AlertCircle } from 'lucide-react';

const STATUS_CONFIG = {
  activo:     { label: 'Activo',     badge: 'badge-success' },
  pausado:    { label: 'En pausa',   badge: 'badge-warning' },
  finalizado: { label: 'Finalizado', badge: 'badge-gray' },
};

const FormField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-medium text-ink-secondary">{label}</label>
    {children}
  </div>
);

export const ProjectsPanel = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectService.getAll(),
  });
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => userService.getAll() });
  const { data: fichas = [] } = useQuery({ queryKey: ['fichas'], queryFn: () => fichaService.getAll() });

  const leaders = (users as any[]).filter((u: any) => u.rol === 'lider_tecnico');

  const deleteMutation = useMutation({
    mutationFn: projectService.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });
  const createMutation = useMutation({
    mutationFn: projectService.create,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects'] }); setIsModalOpen(false); },
  });
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, estado }: any) => projectService.updateStatus(id, estado),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    createMutation.mutate({
      nombre:                f.get('nombre') as string,
      descripcion:           f.get('descripcion') as string,
      liderId:               Number(f.get('liderId')) || undefined,
      fichaId:               Number(f.get('fichaId')) || undefined,
      instructorId:          user?.id,
      competencia:           f.get('competencia') as string,
      resultado_aprendizaje: f.get('resultado_aprendizaje') as string,
      fecha_inicio:          f.get('fecha_inicio') as string,
      fecha_fin:             f.get('fecha_fin') as string,
    } as any);
  };

  const p = projects as any[];
  const filtered = p.filter(proj => {
    const matchSearch = proj.nombre?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || proj.estado === statusFilter;
    return matchSearch && matchStatus;
  });

  const canCreate = user?.rol === 'coordinador' || user?.rol === 'instructor';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="section-title">Proyectos</h2>
          <p className="section-subtitle">{p.filter(x => x.estado === 'activo').length} activos · {p.length} total</p>
        </div>
        {canCreate && (
          <button onClick={() => setIsModalOpen(true)} className="btn-primary flex items-center gap-2">
            <Plus size={14} /> Nuevo proyecto
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar proyecto..."
            className="input-base pl-8 w-52 text-sm"
          />
        </div>
        <div className="flex gap-1 bg-surface-hover border border-surface-border rounded-lg p-1">
          {[
            { key: 'all', label: 'Todos' },
            { key: 'activo', label: 'Activos' },
            { key: 'pausado', label: 'En pausa' },
            { key: 'finalizado', label: 'Finalizados' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                statusFilter === key ? 'bg-surface-card text-ink-primary' : 'text-ink-muted hover:text-ink-secondary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1,2,3].map(n => <div key={n} className="h-14 bg-surface-hover rounded-lg animate-pulse" />)}
          </div>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Proyecto</th>
                <th>Ficha</th>
                <th>Estado</th>
                <th>Líder</th>
                <th>Fechas</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <AlertCircle size={24} className="mx-auto text-ink-muted mb-2 opacity-40" />
                    <p className="text-sm text-ink-muted">No se encontraron proyectos</p>
                  </td>
                </tr>
              ) : filtered.map((proj: any) => {
                const sc = STATUS_CONFIG[proj.estado as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.activo;
                return (
                  <tr key={proj.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 bg-info-light rounded-lg flex items-center justify-center shrink-0">
                          <FolderKanban size={14} className="text-info" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-ink-primary">{proj.nombre}</p>
                          <p className="text-xs text-ink-muted line-clamp-1">{proj.descripcion}</p>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="text-xs text-ink-muted">{proj.ficha?.codigo ?? '—'}</span>
                    </td>

                    <td>
                      <select
                        value={proj.estado}
                        onChange={e => updateStatusMutation.mutate({ id: proj.id, estado: e.target.value })}
                        className={`badge cursor-pointer outline-none appearance-none ${sc.badge}`}
                      >
                        <option value="activo">Activo</option>
                        <option value="pausado">En pausa</option>
                        <option value="finalizado">Finalizado</option>
                      </select>
                    </td>

                    <td>
                      {proj.lider ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-success-light border border-success-border flex items-center justify-center overflow-hidden shrink-0">
                            <span className="text-[8px] font-semibold text-success">{proj.lider.nombre?.slice(0,2).toUpperCase()}</span>
                          </div>
                          <span className="text-xs text-ink-secondary">{proj.lider.nombre}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-ink-muted">Sin asignar</span>
                      )}
                    </td>

                    <td>
                      <p className="text-xs text-ink-muted">{proj.fecha_inicio} → {proj.fecha_fin}</p>
                    </td>

                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Botón Tablero: navega a /projects/:id/kanban */}
                        <button
                          onClick={() => navigate(`/projects/${proj.id}/kanban`)}
                          className="btn-ghost text-xs flex items-center gap-1 hover:text-primary-500"
                          title="Ver tablero Kanban"
                        >
                          <LayoutGrid size={13} />
                          Tablero
                        </button>
                        {canCreate && (
                          <button
                            onClick={() => { if (confirm(`¿Eliminar "${proj.nombre}"?`)) deleteMutation.mutate(proj.id); }}
                            className="btn-ghost text-xs hover:text-danger"
                            title="Eliminar"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal nuevo proyecto */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nuevo proyecto">
        <form onSubmit={handleCreate} className="space-y-4">
          <FormField label="Nombre del proyecto">
            <input name="nombre" required placeholder="Ej: Sistema de Inventarios SENA" className="input-base" />
          </FormField>
          <FormField label="Descripción">
            <textarea name="descripcion" required rows={2} className="input-base resize-none" />
          </FormField>
          <FormField label="Ficha del programa">
            <select name="fichaId" required className="input-base">
              <option value="">Selecciona la ficha...</option>
              {(fichas as any[]).map((f: any) => (
                <option key={f.id} value={f.id}>{f.codigo} – {f.nombre || f.programa}</option>
              ))}
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Competencia">
              <textarea name="competencia" required rows={2} className="input-base resize-none" />
            </FormField>
            <FormField label="Resultado de aprendizaje">
              <textarea name="resultado_aprendizaje" required rows={2} className="input-base resize-none" />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Fecha de inicio">
              <input name="fecha_inicio" type="date" required className="input-base" />
            </FormField>
            <FormField label="Fecha de fin">
              <input name="fecha_fin" type="date" required className="input-base" />
            </FormField>
          </div>
          <FormField label="Asignar líder técnico">
            <select name="liderId" className="input-base">
              <option value="">Sin asignar por ahora</option>
              {leaders.map((l: any) => (
                <option key={l.id} value={l.id}>{l.nombre}</option>
              ))}
            </select>
          </FormField>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
          >
            {createMutation.isPending ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creando...</>
            ) : 'Crear proyecto'}
          </button>
        </form>
      </Modal>
    </div>
  );
};
