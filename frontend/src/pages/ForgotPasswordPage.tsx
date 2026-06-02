/**
 * ForgotPasswordPage — Recuperación de contraseña por correo.
 * Ruta: /forgot-password (dentro de AuthLayout).
 * Diseño: zinc oscuro, centrado en pantalla, coherente con el sistema.
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { Mail, AlertCircle, ArrowLeft, CheckCircle2, Send } from 'lucide-react';
import { KanbanaLogo } from '../components/KanbanaLogo';
import api from '../services/api';

export const ForgotPasswordPage = () => {
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm({ defaultValues: { email: '' } });

  const onSubmit = async (data: { email: string }) => {
    try {
      setError(null);
      await api.post('/auth/forgot-password', { email: data.email });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'No pudimos procesar tu solicitud. Verifica el correo.');
    }
  };

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

          {/* ── Estado de éxito ──────────────────────────────────────── */}
          {success ? (
            <div className="p-8 text-center space-y-5">
              <div className="w-14 h-14 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                <CheckCircle2 size={26} className="text-emerald-400" />
              </div>
              <div>
                <h2 className="text-[17px] font-black text-white tracking-tight">¡Correo enviado!</h2>
                <p className="text-[12px] text-zinc-400 leading-relaxed mt-2">
                  Si el correo existe en el sistema, recibirás un enlace de recuperación válido por <span className="text-zinc-200 font-semibold">30 minutos</span>.
                  Revisa también la carpeta de spam.
                </p>
              </div>
              <Link
                to="/"
                className="flex items-center justify-center gap-2 w-full py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 text-zinc-300 hover:text-white text-sm font-bold rounded-md transition-all"
              >
                <ArrowLeft size={14} /> Volver al inicio
              </Link>
            </div>

          /* ── Formulario ─────────────────────────────────────────────── */
          ) : (
            <div className="p-7 space-y-5">
              {/* Encabezado */}
              <div className="space-y-1">
                <h2 className="text-[17px] font-black text-white tracking-tight">Recuperar contraseña</h2>
                <p className="text-[12px] text-zinc-500 leading-relaxed">
                  Ingresa tu correo y te enviamos un enlace para restablecer tu contraseña.
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2.5 p-3 bg-rose-500/10 border border-rose-500/20 rounded-md text-rose-400 text-xs">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Correo */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] uppercase tracking-[0.18em] font-black text-zinc-500">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                    <input
                      {...register('email', {
                        required: 'El correo es obligatorio',
                        pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/i, message: 'Correo inválido' },
                      })}
                      type="email"
                      placeholder="ejemplo@gmail.com"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-md pl-10 pr-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                  {errors.email && (
                    <p className="text-[11px] text-rose-400 ml-1">{errors.email.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-black rounded-md transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]"
                >
                  {isSubmitting
                    ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Enviando...</>
                    : <><Send size={14} /> Enviar enlace</>}
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
          )}
        </div>
      </div>
    </div>
  );
};
