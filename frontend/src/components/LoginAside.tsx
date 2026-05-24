import { useState, useEffect, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle, X, GripVertical } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { KanbanaLogo } from './KanbanaLogo';

interface LoginCredentials {
  email: string;
  password: string;
}

interface LoginAsideProps {
  isOpen: boolean;
  onClose: () => void;
}

const MIN_WIDTH     = 320;
const MAX_WIDTH     = 620;
const DEFAULT_WIDTH = 440;

export const LoginAside = ({ isOpen, onClose }: LoginAsideProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [width,        setWidth]        = useState(DEFAULT_WIDTH);
  const { login } = useAuth();

  const isDragging = useRef(false);
  const startX     = useRef(0);
  const startWidth = useRef(DEFAULT_WIDTH);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<LoginCredentials>({ defaultValues: { email: '', password: '' } });

  useEffect(() => {
    if (!isOpen) { setError(null); reset(); }
  }, [isOpen, reset]);

  // ── Drag-to-resize ────────────────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current  = true;
    startX.current      = e.clientX;
    startWidth.current  = width;
    document.body.style.cursor     = 'ew-resize';
    document.body.style.userSelect = 'none';
  }, [width]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta    = startX.current - e.clientX;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta));
      setWidth(newWidth);
    };
    const onMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current             = false;
      document.body.style.cursor     = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
    };
  }, []);

  const onSubmit = async (data: LoginCredentials) => {
    try {
      setError(null);
      await login(data.email, data.password);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Credenciales incorrectas. Intenta de nuevo.');
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Panel aside */}
      <aside
        style={{ width: isOpen ? width : 0 }}
        className={`fixed top-0 right-0 h-full z-[100] bg-zinc-950 border-l border-zinc-800 flex flex-col justify-between overflow-y-auto overflow-x-hidden shadow-[0_0_60px_rgba(0,0,0,0.8)] transition-[transform,opacity] duration-300 ease-in-out text-zinc-100 selection:bg-blue-600 selection:text-white ${
          isOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
        }`}
      >
        {/* Drag handle */}
        <div
          onMouseDown={onMouseDown}
          className="absolute left-0 top-0 h-full w-3 z-10 flex items-center justify-center cursor-ew-resize group"
          title="Arrastrar para redimensionar"
        >
          <div className="w-[3px] h-16 rounded-full bg-zinc-700 group-hover:bg-blue-500 transition-colors" />
          <GripVertical
            size={14}
            className="absolute text-zinc-600 group-hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100"
          />
        </div>

        <div className="pl-5 pr-6 pt-5 pb-8 md:pl-8 md:pr-8 flex flex-col gap-6 flex-1">

          {/* Cerrar */}
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="p-2 text-zinc-500 hover:text-white bg-zinc-900 border border-zinc-800 rounded-xl transition-colors active:scale-95"
            >
              <X size={18} />
            </button>
          </div>

          {/* ── Logo animado ──────────────────────────────────────────── */}
          <div className="flex flex-col items-center gap-3">
            <KanbanaLogo
              size={60}
              iconBorder="ring-1 ring-blue-500/20"
            />
            <div className="text-center">
              <h1 className="text-2xl font-black tracking-[-0.05em] text-white">Kanbana</h1>
              <p className="text-xs text-zinc-400 font-medium mt-0.5">
                Sistema de gestión <span className="text-blue-400 font-bold">SENA · ADSO</span>
              </p>
            </div>
          </div>

          {/* ── Formulario ───────────────────────────────────────────── */}
          <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-6 space-y-5 shadow-inner">
            <div>
              <h2 className="text-base font-bold tracking-tight text-white">Iniciar sesión</h2>
              <p className="text-[11px] text-zinc-500 mt-0.5">Ingresa tus credenciales autorizadas.</p>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-zinc-400">
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    {...register('email', {
                      required: 'El correo es obligatorio',
                      pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Formato inválido' },
                    })}
                    type="email"
                    placeholder="ejemplo@misena.edu.co"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all duration-200"
                  />
                </div>
                {errors.email && <p className="text-xs text-rose-400 pl-1">{errors.email.message}</p>}
              </div>

              {/* Contraseña */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-zinc-400">
                    Contraseña
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                    onClick={onClose}
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <div className="relative">
                  <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    {...register('password', { required: 'La contraseña es obligatoria' })}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-11 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-rose-400 pl-1">{errors.password.message}</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:pointer-events-none text-white text-sm font-black rounded-xl transition-all shadow-lg shadow-blue-600/20 active:scale-95 duration-200 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Verificando...
                  </>
                ) : 'Iniciar sesión'}
              </button>
            </form>

            <p className="text-xs text-zinc-400 text-center pt-2">
              ¿No tienes cuenta?{' '}
              <Link
                to="/register"
                onClick={onClose}
                className="text-blue-400 hover:text-blue-300 font-bold transition-colors"
              >
                Regístrate ahora
              </Link>
            </p>
          </div>

          {/* Dev hint */}
          {import.meta.env.DEV && (
            <div className="p-3 bg-zinc-900 border border-zinc-800/60 rounded-xl">
              <p className="text-[10px] text-zinc-500 tracking-wide text-center">
                <span className="font-bold text-blue-400 uppercase mr-1">Dev:</span>
                coordinador@sena.edu.co · kanbana2026
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
