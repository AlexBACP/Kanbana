import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  UserPlus, Search, Mail, Trash2, Shield, 
  User, Lock, CheckCircle2, XCircle, Filter, 
  ChevronDown, UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { userService } from '../../services/user.service';
import { Button } from '../../components/Button';
import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { useForm } from 'react-hook-form';
import { CreateUserDto } from '../../types/user.types';

export const UsersPanel = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const queryClient = useQueryClient();

  // --- PETICIONES AL BACKEND ---
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: userService.getAll,
  });

  const createMutation = useMutation({
    mutationFn: userService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsModalOpen(false);
      reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => userService.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, rol }: { id: number; rol: any }) => 
      userService.updateRole(id, rol),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (id: number) => userService.toggleStatus(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  // --- FORMULARIO Y FILTROS ---
  const { register, handleSubmit, reset } = useForm<CreateUserDto>();

  const onSubmit = (data: CreateUserDto) => {
    createMutation.mutate(data);
  };

  const filtered = (users || []).filter(u => {
    const nombre = u?.nombre?.toLowerCase() || "";
    const correo = u?.correo?.toLowerCase() || "";
    const term = search.toLowerCase();
    const matchSearch = nombre.includes(term) || correo.includes(term);
    const matchRole = roleFilter === 'all' || u.rol === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-white tracking-tight">Directorio de Usuarios</h2>
          <p className="text-dark-muted font-bold mt-2 flex items-center gap-2">
            <UserCheck size={16} className="text-primary-500" />
            Control de acceso y perfiles del sistema Kanbana
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Buscador Pro */}
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre..."
              className="pl-12 pr-6 py-3 rounded-2xl bg-dark-card border border-dark-border text-white w-full md:w-72 focus:border-primary-500 outline-none transition-all shadow-xl"
            />
          </div>

          {/* Filtro Dropdown */}
          <div className="relative flex items-center bg-dark-card border border-dark-border rounded-2xl px-4 py-3">
            <Filter size={16} className="text-dark-muted mr-2" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-transparent text-white font-bold text-sm outline-none cursor-pointer appearance-none pr-4"
            >
              <option value="all">Todos los Roles</option>
              <option value="coordinador">Coordinador</option>
              <option value="instructor">Instructor</option>
              <option value="lider_tecnico">Líder Técnico</option>
              <option value="aprendiz">Aprendiz</option>
            </select>
          </div>

          <Button 
            onClick={() => setIsModalOpen(true)}
            className="rounded-2xl px-8 py-3 bg-primary-500 hover:bg-primary-600 shadow-lg shadow-primary-500/20 flex items-center gap-2 transform active:scale-95 transition-all font-black"
          >
            <UserPlus size={20} /> Nuevo
          </Button>
        </div>
      </div>

      {/* TABLA REDISEÑADA */}
      <div className="bg-dark-card rounded-[2.5rem] border border-dark-border shadow-2xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/5 border-b border-dark-border">
              <th className="p-6 text-[10px] font-black uppercase tracking-widest text-dark-muted">Perfil de Usuario</th>
              <th className="p-6 text-[10px] font-black uppercase tracking-widest text-dark-muted">Nivel de Acceso</th>
              <th className="p-6 text-[10px] font-black uppercase tracking-widest text-dark-muted">Estado</th>
              <th className="p-6 text-right text-[10px] font-black uppercase tracking-widest text-dark-muted">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {filtered.map((u, i) => (
                <motion.tr 
                  key={u.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="border-b border-dark-border/40 hover:bg-white/[0.02] transition-colors group"
                >
                  <td className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-black shadow-lg">
                        {u.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white font-bold text-lg leading-tight">{u.nombre}</p>
                        <p className="text-dark-muted text-xs font-medium flex items-center gap-1 mt-1">
                          <Mail size={12} /> {u.correo}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="p-6">
                    <div className="relative inline-flex items-center">
                      <Shield size={14} className="absolute left-3 text-primary-400 pointer-events-none" />
                      <select
                        value={u.rol}
                        onChange={(e) => updateRoleMutation.mutate({ id: u.id, rol: e.target.value })}
                        className="pl-9 pr-8 py-2 bg-dark-bg/60 border border-dark-border rounded-xl text-xs font-black text-white outline-none hover:border-primary-500 appearance-none cursor-pointer transition-all"
                      >
                        <option value="aprendiz">Aprendiz</option>
                        <option value="lider_tecnico">Líder Técnico</option>
                        <option value="instructor">Instructor</option>
                        <option value="coordinador">Coordinador</option>
                      </select>
                    </div>
                  </td>

                  <td className="p-6">
                    <button
                      onClick={() => toggleActiveMutation.mutate(u.id)}
                      className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-tighter transition-all ${
                        u.activo 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {u.activo ? 'Cuenta Activa' : 'Desactivada'}
                    </button>
                  </td>

                  <td className="p-6 text-right">
                    <button
                      onClick={() => window.confirm('¿Eliminar este usuario?') && deleteMutation.mutate(u.id)}
                      className="p-3 text-dark-muted hover:text-rose-400 hover:bg-rose-400/10 rounded-xl transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
        {isLoading && <div className="p-20 text-center text-primary-500 font-black animate-pulse">CARGANDO DIRECTORIO...</div>}
      </div>

      {/* MODAL DE CREACIÓN REDISEÑADO */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title="Matricular Nuevo Usuario"
      >
        <div className="p-2">
          <p className="text-dark-muted text-sm mb-8 font-medium">
            Completa los datos para dar de alta a un nuevo integrante en la plataforma.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Bloque Identidad */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-primary-500 uppercase tracking-[0.2em] mb-4">Información de Perfil</h4>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-muted" size={18} />
                  <input 
                    {...register('nombre', { required: true })} 
                    placeholder="Nombre Completo" 
                    className="w-full pl-12 pr-4 py-4 bg-dark-bg border border-dark-border rounded-2xl text-white outline-none focus:border-primary-500 transition-all shadow-inner"
                  />
                </div>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-muted" size={18} />
                  <input 
                    {...register('correo', { required: true })} 
                    placeholder="Correo Institucional" 
                    className="w-full pl-12 pr-4 py-4 bg-dark-bg border border-dark-border rounded-2xl text-white outline-none focus:border-primary-500 transition-all shadow-inner"
                  />
                </div>
              </div>

              {/* Bloque Seguridad */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-primary-500 uppercase tracking-[0.2em] mb-4">Accesos y Seguridad</h4>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-muted" size={18} />
                  <input 
                    type="password" 
                    {...register('contrasena', { required: true })} 
                    placeholder="Contraseña Temporal" 
                    className="w-full pl-12 pr-4 py-4 bg-dark-bg border border-dark-border rounded-2xl text-white outline-none focus:border-primary-500 transition-all shadow-inner"
                  />
                </div>
                <div className="relative">
                  <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-muted" size={18} />
                  <select 
                    {...register('rol', { required: true })} 
                    className="w-full pl-12 pr-10 py-4 bg-dark-bg border border-dark-border rounded-2xl text-white outline-none focus:border-primary-500 appearance-none cursor-pointer shadow-inner"
                  >
                    <option value="aprendiz">Rol: Aprendiz</option>
                    <option value="instructor">Rol: Instructor</option>
                    <option value="lider_tecnico">Rol: Líder Técnico</option>
                    <option value="coordinador">Rol: Coordinador</option>
                  </select>
                  <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-muted pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-6 mt-4 border-t border-dark-border">
              <Button 
                type="button" 
                variant="outline" 
                className="flex-1 py-4 border-dark-border hover:bg-white/5 rounded-2xl font-bold"
                onClick={() => setIsModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                className="flex-[2] py-4 bg-primary-500 hover:bg-primary-600 rounded-2xl font-black shadow-xl shadow-primary-500/20 active:scale-95 transition-all"
              >
                Confirmar Matrícula
              </Button>
            </div>
          </form>
        </div>
      </Modal>

    </div>
  );
};