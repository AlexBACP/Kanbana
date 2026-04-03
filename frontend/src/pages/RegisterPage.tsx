import { User, Mail, Lock, AlertCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { CreateUserDto, UserRole } from '../types/user.types';
import { userService } from '../services/user.service';
import { useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { Button } from '../components/Button';

export const RegisterPage = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserDto>({
    defaultValues: {
      nombre: '',
      correo: '',
      contrasena: '',
      rol: 'aprendiz' as UserRole,
    },
  });

  const onSubmit = async (data: CreateUserDto) => {
    try {
      setError(null);
      // Aseguramos que el rol sea aprendiz para registros públicos
      const registrationData: CreateUserDto = { 
        ...data, 
        rol: 'aprendiz' as UserRole 
      };
      await userService.create(registrationData);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      const errorResponse = err as any;
      setError(
        errorResponse.response?.data?.message || 'Error al crear la cuenta. Intenta con otro correo.'
      );
    }
  };

  return (
    <div className="w-full max-w-md animate-in">
      <div className="bg-dark-card p-10 rounded-[2.5rem] shadow-2xl border border-dark-border relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-600 to-indigo-600" />
        
        <div className="mb-10 text-center">
          <div className="w-16 h-16 bg-primary-600/10 rounded-2xl flex items-center justify-center text-primary-500 mx-auto mb-6 border border-primary-500/20 shadow-xl shadow-primary-500/5">
            <User size={32} />
          </div>
          <h2 className="text-3xl font-black text-dark-text tracking-tight mb-2">Crear Cuenta</h2>
          <p className="text-dark-muted font-medium">Únete a la gestión de proyectos ADSO</p>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3 text-rose-400 text-sm animate-shake">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <p className="font-bold">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-8 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-sm font-bold text-center">
            ¡Cuenta creada con éxito! Redirigiendo...
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-xs font-black text-dark-muted uppercase tracking-widest ml-1">Nombre Completo</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-dark-muted group-focus-within:text-primary-500 transition-colors">
                <User size={18} />
              </div>
              <input
                {...register('nombre', { required: 'El nombre es obligatorio' })}
                type="text"
                placeholder="Tu nombre"
                className="block w-full pl-12 pr-4 py-4 bg-dark-bg/50 border border-dark-border rounded-2xl text-sm text-dark-text outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all placeholder:text-dark-muted/50"
              />
            </div>
            {errors.nombre && <p className="mt-1 text-xs text-rose-500 font-bold ml-1">{errors.nombre.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-black text-dark-muted uppercase tracking-widest ml-1">Correo Electrónico</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-dark-muted group-focus-within:text-primary-500 transition-colors">
                <Mail size={18} />
              </div>
              <input
                {...register('correo', { 
                  required: 'El correo es obligatorio',
                  pattern: { value: /^\S+@\S+$/i, message: 'Correo inválido' }
                })}
                type="email"
                placeholder="ejemplo@sena.edu.co"
                className="block w-full pl-12 pr-4 py-4 bg-dark-bg/50 border border-dark-border rounded-2xl text-sm text-dark-text outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all placeholder:text-dark-muted/50"
              />
            </div>
            {errors.correo && <p className="mt-1 text-xs text-rose-500 font-bold ml-1">{errors.correo.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-black text-dark-muted uppercase tracking-widest ml-1">Contraseña</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-dark-muted group-focus-within:text-primary-500 transition-colors">
                <Lock size={18} />
              </div>
              <input
                {...register('contrasena', {
                  required: 'La contraseña es obligatoria',
                  minLength: { value: 6, message: 'Mínimo 6 caracteres' }
                })}
                type="password"
                placeholder="••••••••"
                className="block w-full pl-12 pr-4 py-4 bg-dark-bg/50 border border-dark-border rounded-2xl text-sm text-dark-text outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all placeholder:text-dark-muted/50"
              />
            </div>
            {errors.contrasena && <p className="mt-1 text-xs text-rose-500 font-bold ml-1">{errors.contrasena.message}</p>}
          </div>

          <Button 
            type="submit" 
            isLoading={isSubmitting} 
            className="w-full py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-primary-500/20 active:scale-[0.98] transition-all"
          >
            Registrarme ahora
          </Button>

          <div className="pt-4 text-center">
            <p className="text-sm text-dark-muted font-bold">
              ¿Ya tienes cuenta?{' '}
              <Link to="/login" className="text-primary-400 hover:text-primary-300 transition-colors">
                Inicia sesión
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};
