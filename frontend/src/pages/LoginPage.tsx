/**
 * LoginPage — funciona en dos modos:
 *
 * 1. POPUP (abierto desde el landing):
 *    window.opener existe → al loguearse exitosamente envía postMessage al padre
 *    con { type: 'LOGIN_SUCCESS', rol } y cierra la ventana.
 *
 * 2. DIRECTO (navegación normal a /login):
 *    window.opener es null → al loguearse navega al dashboard normalmente.
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface LoginCredentials {
  email: string;
  password: string;
}

const isPopup = (): boolean => {
  try {
    return !!(window.opener && !window.opener.closed && window.opener !== window);
  } catch {
    return false;
  }
};

export const LoginPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();
  const popup = isPopup();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginCredentials>({ defaultValues: { email: '', password: '' } });

  const onSubmit = async (data: LoginCredentials) => {
    try {
      setError(null);
      // useAuth.login() maneja tanto popup como navegación normal
      await login(data.email, data.password);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Credenciales incorrectas. Intenta de nuevo.');
    }
  };

  return (
    <div className={`w-full ${popup ? 'min-h-screen bg-[#0d1117] flex items-center justify-center p-6' : ''}`}>
      <div className={`w-full ${popup ? 'max-w-sm' : ''}`}>
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-indigo-600 rounded-xl mb-3">
            <span className="text-base font-bold text-white">K</span>
          </div>
          <h1 className="text-base font-semibold text-dark-text">Kanbana</h1>
          <p className="text-xs text-dark-muted mt-0.5">
            {popup ? 'Inicia sesión para continuar' : 'Sistema de gestión SENA · ADSO'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-dark-text">Iniciar sesión</h2>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
            {/* Email */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-dark-muted">Correo electrónico</label>
              <div className="relative">
                <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted/60" />
                <input
                  {...register('email', {
                    required: 'Campo obligatorio',
                    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Correo inválido' },
                  })}
                  type="email"
                  placeholder="ejemplo@sena.edu.co"
                  className="input-dark pl-9 text-sm py-2.5"
                />
              </div>
              {errors.email && <p className="text-xs text-rose-400">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-dark-muted">Contraseña</label>
                {!popup && (
                  <Link to="/forgot-password" className="text-xs text-primary-400 hover:text-primary-300 transition-colors">
                    ¿Olvidaste tu contraseña?
                  </Link>
                )}
              </div>
              <div className="relative">
                <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted/60" />
                <input
                  {...register('password', { required: 'Campo obligatorio' })}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="input-dark pl-9 pr-10 text-sm py-2.5"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-muted/60 hover:text-dark-muted transition-colors"
                >
                  {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-rose-400">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-primary-600 hover:bg-primary-500 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Verificando...
                </>
              ) : 'Iniciar sesión'}
            </button>
          </form>

          {!popup && (
            <p className="text-xs text-dark-muted text-center">
              ¿No tienes cuenta?{' '}
              <Link to="/register" className="text-primary-400 hover:text-primary-300 transition-colors font-medium">
                Regístrate
              </Link>
            </p>
          )}
        </div>

        {/* Demo hint */}
        <div className="mt-3 p-3 border border-dark-border/60 rounded-xl">
          <p className="text-[10px] text-dark-muted text-center">
            Demo: coordinador@sena.edu.co · kanbana2026
          </p>
        </div>
      </div>
    </div>
  );
};
