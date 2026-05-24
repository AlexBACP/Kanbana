import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight, ShieldCheck, ChevronLeft } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { KanbanaLogo } from '../components/KanbanaLogo';
import { BubblesBg }   from '../components/BubblesBg';

interface LoginCredentials {
  email: string;
  password: string;
}

export const LoginPage = () => {
  const [showPassword,   setShowPassword]   = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [step,           setStep]           = useState<'credentials' | 'totp'>('credentials');
  const [totpCode,       setTotpCode]       = useState('');
  const [totpLoading,    setTotpLoading]    = useState(false);
  const [savedCreds,     setSavedCreds]     = useState<{ email: string; password: string } | null>(null);
  const { login } = useAuth();
  const [searchParams] = useSearchParams();
  const redirectAfter  = searchParams.get('redirect') ?? undefined;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginCredentials>({ defaultValues: { email: '', password: '' } });

  const onSubmit = async (data: LoginCredentials) => {
    try {
      setError(null);
      const result = await login(data.email, data.password, redirectAfter);
      if (result.requires2fa) {
        setSavedCreds({ email: data.email, password: data.password });
        setStep('totp');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Credenciales incorrectas. Intenta de nuevo.');
    }
  };

  const onTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!savedCreds || !totpCode.trim()) return;
    try {
      setError(null);
      setTotpLoading(true);
      await login(savedCreds.email, savedCreds.password, redirectAfter, totpCode.trim());
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Código inválido. Intenta de nuevo.');
    } finally {
      setTotpLoading(false);
    }
  };

  // ── Paso 2: verificar código TOTP ─────────────────────────────────────────
  if (step === 'totp') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 relative overflow-hidden selection:bg-blue-600 selection:text-white">
        <BubblesBg />
        <div className="relative z-10 w-full max-w-[420px]">
          <div className="flex flex-col items-center mb-8 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
              <ShieldCheck size={26} className="text-blue-400" />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-black tracking-tight text-white">Verificación en dos pasos</h1>
              <p className="text-xs text-zinc-500 mt-1">Abre Google Authenticator y copia el código de 6 dígitos</p>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-md p-7 shadow-[0_30px_70px_rgba(0,0,0,0.6)]">
            {error && (
              <div className="flex items-start gap-2.5 p-3 bg-rose-500/10 border border-rose-500/20 rounded-md text-rose-400 text-xs mb-5">
                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={onTotpSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.18em]">
                  Código de autenticación
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  autoFocus
                  value={totpCode}
                  onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000 000"
                  className="w-full text-center text-2xl font-mono tracking-[0.35em] px-4 py-4
                             bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100
                             placeholder:text-zinc-700 outline-none focus:border-blue-500/60
                             focus:ring-1 focus:ring-blue-500/20 transition-all"
                />
                <p className="text-[10px] text-zinc-600 text-center">El código cambia cada 30 segundos</p>
              </div>

              <button
                type="submit"
                disabled={totpLoading || totpCode.length !== 6}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600
                           hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed
                           text-white text-sm font-black rounded-md transition-all
                           shadow-lg shadow-blue-600/20 active:scale-[0.98]"
              >
                {totpLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>Verificar <ArrowRight size={14} /></>
                )}
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-zinc-800">
              <button
                onClick={() => { setStep('credentials'); setError(null); setTotpCode(''); }}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mx-auto"
              >
                <ChevronLeft size={13} /> Volver al inicio de sesión
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 relative overflow-hidden selection:bg-blue-600 selection:text-white">

      {/* Burbujas animadas de fondo */}
      <BubblesBg />

      {/* Anillos decorativos estáticos */}
      <div className="absolute left-[-120px] top-[10%] h-[500px] w-[500px] rounded-full border border-white/4 pointer-events-none" />
      <div className="absolute right-[-100px] bottom-[5%] h-[400px] w-[400px] rounded-full border border-blue-600/8 pointer-events-none" />
      <div className="absolute top-[-60px] left-[40%] w-[350px] h-[250px] rounded-full bg-blue-600/5 blur-[100px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-[420px]">

        {/* Logo + marca */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <KanbanaLogo size={56} iconBorder="ring-1 ring-blue-500/20" />
          <div className="text-center">
            <h1 className="text-2xl font-black tracking-[-0.05em] text-white">Kanbana</h1>
            <p className="text-xs text-zinc-500 mt-0.5">Sistema de gestión de proyectos · SENA ADSO</p>
          </div>
        </div>

        {/* Card principal */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-md p-7 shadow-[0_30px_70px_rgba(0,0,0,0.6)]">

          <div className="mb-6">
            <h2 className="text-lg font-black text-white tracking-tight">Iniciar sesión</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Ingresa con tus credenciales del programa formativo</p>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 p-3 bg-rose-500/10 border border-rose-500/20 rounded-md text-rose-400 text-xs mb-5">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.18em]">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                <input
                  {...register('email', {
                    required: 'Campo obligatorio',
                    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Correo inválido' },
                  })}
                  type="email"
                  placeholder="ejemplo@sena.edu.co"
                  className="w-full pl-10 pr-4 py-3 bg-zinc-950 border border-zinc-800 rounded-md text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all"
                />
              </div>
              {errors.email && <p className="text-[11px] text-rose-400 ml-1">{errors.email.message}</p>}
            </div>

            {/* Contraseña */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.18em]">
                  Contraseña
                </label>
                <Link
                  to="/forgot-password"
                  className="text-[10px] font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <div className="relative">
                <Lock size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                <input
                  {...register('password', { required: 'Campo obligatorio' })}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-11 py-3 bg-zinc-950 border border-zinc-800 rounded-md text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
              {errors.password && <p className="text-[11px] text-rose-400 ml-1">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-black rounded-md transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Verificando...
                </>
              ) : (
                <>Iniciar sesión <ArrowRight size={14} /></>
              )}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-zinc-800">
            <p className="text-xs text-zinc-500 text-center">
              ¿No tienes cuenta?{' '}
              <Link to="/register" className="text-blue-400 hover:text-blue-300 font-bold transition-colors">
                Regístrate
              </Link>
            </p>
          </div>
        </div>

        {/* Dev hint */}
        {import.meta.env.DEV && (
          <div className="mt-3 p-3 border border-zinc-800/60 rounded-md bg-zinc-900/50">
            <p className="text-[10px] text-zinc-600 text-center">
              <span className="text-blue-400 font-bold mr-1">Dev:</span>
              coordinador@sena.edu.co · kanbana2026
            </p>
          </div>
        )}

        <div className="mt-4 text-center">
          <Link to="/" className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors">
            ← Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
};
