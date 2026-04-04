import { useQuery, useQueryClient } from '@tanstack/react-query';
import { projectService } from '../../services/project.service';
import { ticketService } from '../../services/ticket.service';
import { useState } from 'react';
import { Search, Plus, MoreHorizontal } from 'lucide-react';
import { Modal } from '../../components/Modal';

export const LiderTickets = () => {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const _qc = useQueryClient();

  const { data: proyectos = [] } = useQuery({
    queryKey: ['projects', 'for-me'],
    queryFn: () => projectService.getForMe(),
  });

  const miProyecto = (proyectos as any[])[0] ?? null;

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['tickets', miProyecto?.id],
    queryFn: () => ticketService.getAll(miProyecto?.id),
    enabled: !!miProyecto?.id,
  });

  const filtered = (tickets as any[]).filter(t => 
    t.titulo.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-dark-text uppercase tracking-widest">
          Tickets del Proyecto
        </h2>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="btn-primary py-1.5 px-3 text-xs flex items-center gap-2"
        >
          <Plus size={14} /> Nuevo Ticket
        </button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" size={14} />
          <input 
            type="text" 
            placeholder="Buscar por título..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-dark-card border border-dark-border rounded-lg pl-9 pr-4 py-2 text-sm text-dark-text outline-none focus:border-primary-500/50 transition-colors"
          />
        </div>
      </div>

      <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-dark-border bg-dark-bg/50">
              <th className="px-4 py-3 font-medium text-dark-muted">Título</th>
              <th className="px-4 py-3 font-medium text-dark-muted">Estado</th>
              <th className="px-4 py-3 font-medium text-dark-muted">Prioridad</th>
              <th className="px-4 py-3 font-medium text-dark-muted">Asignado a</th>
              <th className="px-4 py-3 font-medium text-dark-muted text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-border">
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-dark-muted animate-pulse">Cargando tickets...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-dark-muted">No se encontraron tickets</td></tr>
            ) : filtered.map((t) => (
              <tr key={t.id} className="hover:bg-dark-border/10 transition-colors">
                <td className="px-4 py-3 text-dark-text font-medium">{t.titulo}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${t.estado === 'done' ? 'badge-success' : 'badge-warning'}`}>
                    {t.estado}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs ${t.prioridad === 'alta' ? 'text-rose-400' : 'text-dark-muted'}`}>
                    {t.prioridad}
                  </span>
                </td>
                <td className="px-4 py-3 text-dark-muted">{t.asignado_a?.nombre || 'Sin asignar'}</td>
                <td className="px-4 py-3 text-right">
                  <button className="p-1 hover:bg-dark-border/50 rounded transition-colors text-dark-muted">
                    <MoreHorizontal size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Crear Nuevo Ticket">
        <div className="p-4 text-dark-muted text-sm">
          Formulario de creación de ticket (Próximamente)
        </div>
      </Modal>
    </div>
  );
};
