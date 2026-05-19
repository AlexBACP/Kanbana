import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, GraduationCap, Calendar, Trash2, Edit, BookOpen } from 'lucide-react';
import { fichaService, CreateFichaDto } from '../services/ficha.service';
import { Button } from '../components/Button';
import { useState } from 'react';
import { Modal } from '../components/Modal';
import { useForm } from 'react-hook-form';
import { formatDate } from '../utils/date.utils';

export const FichasPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();

  const { data: fichas = [], isLoading } = useQuery({
    queryKey: ['fichas'],
    queryFn: fichaService.getAll,
  });

  const createMutation = useMutation({
    mutationFn: fichaService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fichas'] });
      setIsModalOpen(false);
      reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: fichaService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fichas'] });
    },
  });

  const { register, handleSubmit, reset } = useForm<CreateFichaDto>();

  const onSubmit = (data: CreateFichaDto) => {
    createMutation.mutate(data);
  };

  const filteredFichas = fichas.filter(f => 
    f.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.programa.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 mx-14">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Fichas</h1>
          <p className="text-gray-500 text-sm">Administra los grupos y programas de formación</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
          <Plus size={18} />
          Nueva Ficha
        </Button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <Search size={18} />
          </div>
          <input
            type="text"
            placeholder="Buscar por código o programa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-40 bg-white rounded-2xl border border-gray-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFichas.map((f) => (
            <div key={f.id} className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center">
                  <GraduationCap size={24} />
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-2 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-primary-50">
                    <Edit size={16} />
                  </button>
                  <button 
                    onClick={() => {
                      if (window.confirm('¿Eliminar esta ficha?')) deleteMutation.mutate(f.id);
                    }}
                    className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-primary-600 transition-colors">
                Ficha {f.codigo}
              </h3>
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                <BookOpen size={14} />
                <span className="line-clamp-1">{f.programa}</span>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <Calendar size={12} />
                  <span>Inicia: {formatDate(f.fecha_inicio)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-orange-500">
                  <Calendar size={12} />
                  <span>Fin: {formatDate(f.fecha_fin)}</span>
                </div>
              </div>
            </div>
          ))}
          
          {filteredFichas.length === 0 && (
            <div className="col-span-full py-12 text-center text-gray-500 italic">
              No se encontraron fichas registradas.
            </div>
          )}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Registrar Nueva Ficha"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Código de Ficha</label>
            <input
              {...register('codigo', { required: 'El código es obligatorio' })}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all"
              placeholder="Ej: 2503412"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Programa de Formación</label>
            <input
              {...register('programa', { required: 'El programa es obligatorio' })}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all"
              placeholder="Ej: ADSO"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Fecha Inicio</label>
              <input
                type="date"
                {...register('fecha_inicio', { required: true })}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Fecha Fin</label>
              <input
                type="date"
                {...register('fecha_fin', { required: true })}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button type="submit" isLoading={createMutation.isPending}>Guardar Ficha</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};