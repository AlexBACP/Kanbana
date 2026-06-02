/**
 * ResetPasswordPage — Establecer nueva contraseña tras el enlace del correo.
 * Ruta: /reset-password?token=... (dentro de AuthLayout).
 * Diseño: zinc oscuro, centrado en pantalla, coherente con el sistema.
 * Validación: política completa (≥7 chars, ≥1 mayúscula, ≥1 número).
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound } from 'lucide-react';
import { KanbanaLogo } from '../components/KanbanaLogo';
import api from '../services/api';

interface FormData {
  newPassword:     string;
  confirmPassword: string;
}

export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const token          = searchParams.get('token');

  const [error,       setError]       = useState<string | null>(null);
  const [success,     setSuccess]     = useState(false);
  const [showPass,    setShowPass]    = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { isSubmitting, errors },
  } = useForm<FormData>();

  const onSubmit = async (data: FormData) => {
    try {
      setError(null);
      await api.post('/auth/reset-password', { token, newPassword: data.newPassword });
      setSuccess(true);
    } catch (err: any) {
      const msg = err.response?.data?.message;
      if (msg?.includes('expirado') || msg?.includes('inválido')) {
        setError('Este enlace ha expirado o ya fue utilizado. Solicita uno nuevo.');
      } else {
        setError(msg || 'No pudimos actualizar tu contraseña. Intenta de nuevo.');
      }
    }
  };

  // ── Pantalla de error: sin token en la URL ───────────────────────────────
  if (!token) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 selection:bg-blue-600 selection:text-white">
        <div className="w-full max-w-[400px]">
          <div className="bg-zinc-900 border border-zinc-800 rounded-md p-8 text-center space-y-5">
            <div className="w-14 h-14 rounded-md bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto">
              <AlertCircle size={26} className="text-rose-400" />
            </div>
            <div>
              <h2 className="text-[17px] font-black text-white tracking-tight">Enlace inválido</h2>
              <p className="text-[12px] text-zinc-400 leading-relaxed mt-2">
                Este enlace de recuperación no es válido o ya fue utilizado.
              </p>
            </div>
            <Link
              to="/forgot-password"
              className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-black rounded-md transition-all active:scale-[0.98]"
            >
              Solicitar nuevo enlace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Pantalla de éxito ────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 selection:bg-blue-600 selection:text-white">
        <div className="w-full max-w-[400px]">
          <div className="bg-zinc-900 border border-zinc-800 rounded-md p-8 text-center space-y-5">
            <div className="w-14 h-14 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
              <CheckCircle2 size={26} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-[17px] font-black text-white tracking-tight">¡Contraseña actualizada!</h2>
              <p className="text-[12px] text-zinc-400 leading-relaxed mt-2">
                Tu contraseña fue cambiada exitosamente. Ya puedes iniciar sesión con tus nuevas credenciales.
              </p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-black rounded-md transition-all active:scale-[0.98]"
            >
              Ir al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Formulario principal ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 selection:bg-blue-600 selection:text-white">

      {/* Decoración de fondo */}
      <div className="pointer-events-none absolute left-1/4 top-1/4 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/3 blur-[120px]" />
      <div className="pointer-events-none absolute right-1/4 bottom-1/4 h-[300px] w-[300px] rounded-full border border-zinc-800/60" />

      <div className="relative z-10 w-full max-w-[400px]">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <KanbanaLogo size={52} iconBorder="ring-1 ring-zinc-700/80" />
          <div className="text-center">
            <h1 className="text-xl font-black tracking-[-0.05em] text-white">Kanbana</h1>
            <p className="text-xs text-zinc-600 mt-0.5">SENA · ADSO</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-md shadow-[0_30px_70px_rgba(0,0,0,0.6)]">
          <div className="p-7 space-y-5">

            {/* Encabezado */}
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <KeyRound size={16} className="text-blue-400" />
                </div>
                <div>
                  <h2 className="text-[17px] font-black text-white tracking-tight leading-tight">Nueva contraseña</h2>
                  <p className="text-[11px] text-zinc-500">Elige una contraseña segura para tu cuenta.</p>
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 p-3 bg-rose-500/10 border border-rose-500/20 rounded-md text-rose-400 text-xs">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="leading-relaxed">{error}</span>
                  {error.includes('expirado') && (
                    <Link
                      to="/forgot-password"
                      className="block text-rose-300 hover:text-rose-200 font-semibold underline transition-colors"
                    >
                      Solicitar nuevo enlace →
                    </Link>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

              {/* Nueva contraseña */}
              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase tracking-[0.18em] font-black text-zinc-500">
                  Nueva contraseña
                </label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                  <input
                    {...register('newPassword', {
                      required: 'La contraseña es obligatoria',
                      validate: (v: string) => {
                        if (v.length < 7)     return 'Mínimo 7 caracteres';
                        if (!/[A-Z]/.test(v)) return 'Incluye al menos una letra mayúscula';
                        if (!/[0-9]/.test(v)) return 'Incluye al menos un número';
                        return true;
                      },
                    })}
                    type={showPass ? 'text' : 'password'}
                    placeholder="Mín. 7, una mayúscula y un número"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-md pl-10 pr-11 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(p => !p)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                  >
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {errors.newPassword
                  ? <p className="text-[11px] text-rose-400 ml-1">{errors.newPassword.message}</p>
                  : <p className="text-[11px] text-zinc-600 ml-1">Mínimo 7 caracteres, una mayúscula y un número.</p>}
              </div>

              {/* Confirmar contraseña */}
              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase tracking-[0.18em] font-black text-zinc-500">
                  Confirmar contraseña
                </label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                  <input
                    {...register('confirmPassword', {
                      required: 'Confirma tu contraseña',
                      validate: (val: string) => val === watch('newPassword') || 'Las contraseñas no coinciden',
                    })}
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Repite la contraseña"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-md pl-10 pr-11 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(p => !p)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                  >
                    {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-[11px] text-rose-400 ml-1">{errors.confirmPassword.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-black rounded-md transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]"
              >
                {isSubmitting
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Actualizando...</>
                  : <><KeyRound size={14} /> Actualizar contraseña</>}
              </button>
            </form>

            {/* Pie */}
            <div className="pt-1 border-t border-zinc-800 text-center">
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <ArrowLeft size={12} /> Volver al inicio
              </Link>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
