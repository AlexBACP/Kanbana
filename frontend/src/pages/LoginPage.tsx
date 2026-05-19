/**
 * LoginPage — formulario de inicio de sesión.
 *
 * ── REDISEÑO VISUAL ──────────────────────────────────────────────────────
 * Patrón de estilos adaptado de la landing page:
 *   - Fondo oscuro #222226 / zinc-900
 *   - Acento verde SENA #27ae60
 *   - Tipografía Poppins, font-black con tracking apretado
 *   - Card con bordes zinc-800, fondo zinc-950
 *   - Botón principal verde con rounded-xl
 *   - Anillos decorativos de fondo
 *   - Demo hint solo en desarrollo (import.meta.env.DEV)
 * ────────────────────────────────────────────────────────────────────────
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface LoginCredentials {
  email: string;
  password: string;
}

export const LoginPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginCredentials>({ defaultValues: { email: '', password: '' } });

  const onSubmit = async (data: LoginCredentials) => {
    try {
      setError(null);
      await login(data.email, data.password);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Credenciales incorrectas. Intenta de nuevo.');
    }
  };

  return (
    <div className="min-h-screen bg-[#222226] flex items-center justify-center p-6 relative overflow-hidden selection:bg-[#27ae60] selection:text-white">

      {/* Anillos decorativos de fondo (mismo patrón que la landing) */}
      <div className="absolute left-[-120px] top-[10%] h-[500px] w-[500px] rounded-full border border-white/5 pointer-events-none" />
      <div className="absolute right-[-100px] bottom-[5%] h-[400px] w-[400px] rounded-full border border-[#27ae60]/8 pointer-events-none" />
      <div className="absolute top-[-60px] left-[40%] w-[350px] h-[250px] rounded-full bg-[#27ae60]/5 blur-[100px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-[400px]">

        {/* Logo y marca */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="text-[22px] font-extrabold text-[#27ae60] tracking-tight">Kanbana</span>
            <span className="text-[10px] font-bold text-zinc-500 bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5">
              SENA · ADSO
            </span>
          </div>
          <p className="text-[12px] text-zinc-500">
            Sistema de gestión de proyectos formativos
          </p>
        </div>

        {/* Card principal */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-[20px] p-7 shadow-[0_25px_60px_rgba(0,0,0,0.5)]">

          <div className="mb-6">
            <h2 className="text-[18px] font-extrabold text-white tracking-[-0.03em]">Iniciar sesión</h2>
            <p className="text-[11px] text-zinc-500 mt-1">Ingresa con tus credenciales del programa</p>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-[12px] mb-5">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.15em]">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                <input
                  {...register('email', {
                    required: 'Campo obligatorio',
                    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Correo inválido' },
                  })}
                  type="email"
                  placeholder="ejemplo@sena.edu.co"
                  className="w-full pl-10 pr-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-[13px] text-white placeholder:text-zinc-600 outline-none focus:border-[#27ae60]/50 transition-colors"
                />
              </div>
              {errors.email && <p className="text-[11px] text-rose-400 ml-1">{errors.email.message}</p>}
            </div>

            {/* Contraseña */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.15em]">
                  Contraseña
                </label>
                <Link
                  to="/forgot-password"
                  className="text-[10px] font-semibold text-[#27ae60] hover:text-[#219653] transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                <input
                  {...register('password', { required: 'Campo obligatorio' })}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-11 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-[13px] text-white placeholder:text-zinc-600 outline-none focus:border-[#27ae60]/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {errors.password && <p className="text-[11px] text-rose-400 ml-1">{errors.password.message}</p>}
            </div>

            {/* Botón submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#27ae60] hover:bg-[#219653] disabled:opacity-50 disabled:cursor-not-allowed text-white text-[13px] font-bold rounded-xl transition-all shadow-lg shadow-[#27ae60]/20 active:scale-[0.98]"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  Iniciar sesión
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Registro */}
          <div className="mt-5 pt-4 border-t border-zinc-800">
            <p className="text-[12px] text-zinc-500 text-center">
              ¿No tienes cuenta?{' '}
              <Link to="/register" className="text-[#27ae60] hover:text-[#219653] font-semibold transition-colors">
                Regístrate
              </Link>
            </p>
          </div>
        </div>

        {/* Demo hint — solo en desarrollo */}
        {import.meta.env.DEV && (
          <div className="mt-4 p-3 border border-zinc-800/60 rounded-xl bg-zinc-900/50">
            <p className="text-[10px] text-zinc-600 text-center">
              Demo: coordinador@sena.edu.co · kanbana2026
            </p>
          </div>
        )}

        {/* Volver a la landing */}
        <div className="mt-5 text-center">
          <Link to="/" className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors">
            ← Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
};
