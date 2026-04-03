import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAuthStore } from '../store/auth.store';
import { Button } from '../components/Button';

interface LoginCredentials {
  email: string;
  password: string;
}

export const LoginPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();

  // 1. LOGICA ANTI-BUCLE: Protege la ruta de login si el usuario ya está autenticado.
  useEffect(() => {
    if (isAuthenticated && user) {
      const destination = user.rol === 'aprendiz' ? '/kanban' : '/dashboard';
      navigate(destination, { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginCredentials>({ defaultValues: { email: '', password: '' } });

  // 2. LOGICA DE ENVÍO: Se añadió redirección manual tras el éxito.
  const onSubmit = async (data: LoginCredentials) => {
    try {
      setError(null);
      // Suponiendo que tu función login devuelve los datos del usuario tras el éxito
      const loggedUser = await login(data.email, data.password);
      
      // CAMBIO: Navegación inmediata. Esto evita esperar al ciclo de renderizado del useEffect.
      if (loggedUser) {
        const destination = loggedUser.rol === 'aprendiz' ? '/kanban' : '/dashboard';
        navigate(destination, { replace: true });
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.message || 'Credenciales incorrectas. Verifica e intenta de nuevo.'
      );
    }
  };

  return (
    <div className="w-full max-w-md animate-in">
      <div className="bg-dark-card p-10 rounded-[2.5rem] shadow-2xl border border-dark-border relative overflow-hidden">
        {/* Decoración superior */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-600 to-indigo-500" />

        {/* Logo y Encabezado */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-600/10 rounded-3xl mb-6 border border-primary-500/20 shadow-xl shadow-primary-500/5 hover:scale-105 transition-transform duration-500">
            <span className="text-4xl font-black text-primary-500 tracking-tighter italic">K</span>
          </div>
          <h2 className="text-3xl font-black text-dark-text tracking-tight mb-1">Bienvenido</h2>
          <p className="text-dark-muted text-sm font-medium">Sistema de gestión de proyectos SENA · ADSO</p>
        </div>

        {/* Mensaje de Error */}
        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3 text-rose-400 text-sm">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <p className="font-bold">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Email */}
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-dark-muted uppercase tracking-widest ml-1">
              Correo Electrónico
            </label>
            <div className="relative group">
              <Mail size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-muted group-focus-within:text-primary-500 transition-colors" />
              <input
                {...register('email', {
                  required: 'El correo es obligatorio',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Correo inválido' },
                })}
                type="email"
                placeholder="ejemplo@sena.edu.co"
                className={`block w-full pl-12 pr-4 py-4 bg-dark-bg/50 border rounded-2xl text-dark-text text-sm transition-all outline-none placeholder:text-dark-muted/40 ${
                  errors.email ? 'border-rose-500/50' : 'border-dark-border focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20'
                }`}
              />
            </div>
            {errors.email && <p className="text-xs text-rose-400 ml-1 font-bold">{errors.email.message}</p>}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-dark-muted uppercase tracking-widest ml-1">
              Contraseña
            </label>
            <div className="relative group">
              <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-muted group-focus-within:text-primary-500 transition-colors" />
              <input
                {...register('password', { required: 'La contraseña es obligatoria' })}
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••"
                className={`block w-full pl-12 pr-12 py-4 bg-dark-bg/50 border rounded-2xl text-dark-text text-sm transition-all outline-none placeholder:text-dark-muted/40 ${
                  errors.password ? 'border-rose-500/50' : 'border-dark-border focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-muted hover:text-dark-text transition-colors"
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-rose-400 ml-1 font-bold">{errors.password.message}</p>}
          </div>

          <div className="flex justify-end">
            <Link to="/forgot-password" className="text-xs font-bold text-primary-400 hover:text-primary-300 transition-colors">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          <Button
            type="submit"
            isLoading={isSubmitting}
            className="w-full py-4 flex items-center justify-center gap-2 mt-2"
          >
            Iniciar Sesión
            {!isSubmitting && <ArrowRight size={16} />}
          </Button>
        </form>

        {/* Info de demostración */}
        <div className="mt-6 p-4 bg-dark-bg/50 rounded-2xl border border-dark-border/60 text-center">
          <p className="text-[10px] text-dark-muted font-bold uppercase tracking-widest">Acceso de demostración</p>
          <p className="text-xs text-dark-muted/70 mt-1">coordinador@sena.edu.co · contraseña: kanbana2026</p>
        </div>
      </div>
    </div>
  );
};