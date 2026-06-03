/**
 * LoginAside — Panel lateral de autenticación unificado.
 *
 * Reemplaza a las antiguas páginas /login y /register: ahora TODO el flujo de
 * acceso (iniciar sesión, registrarse, verificación 2FA y login con Google)
 * vive en este drawer que se abre desde la Landing.
 *
 * Diseño: adaptado al sistema visual de Kanbana (zinc oscuro + azul, rounded-md),
 * conservando el logo animado (KanbanaLogo).
 *
 * Props:
 *   isOpen        — controla la visibilidad del drawer
 *   onClose       — cierra el drawer
 *   redirectAfter — ruta a la que ir tras un login exitoso (opcional)
 *   initialError  — error a mostrar al abrir (ej. fallo del login con Google)
 *   initialMode   — 'login' (def.) o 'register'
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import {
  Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle2, X, GripVertical,
  ArrowRight, ShieldCheck, ChevronLeft, User as UserIcon,
  Layers, Clock, Hash, GraduationCap, BookOpen,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { authService } from '../services/auth.service';
import { KanbanaLogo } from './KanbanaLogo';

interface LoginCredentials {
  email: string;
  password: string;
}
interface RegisterForm {
  nombre: string;
  correo: string;
  contrasena: string;
  codigoFicha: string;
  jornada: 'mañana' | 'tarde' | 'noche';
  documento: string;
}
interface InstrRegisterForm {
  nombre: string;
  correo: string;
  contrasena: string;
}
interface LoginAsideProps {
  isOpen: boolean;
  onClose: () => void;
  redirectAfter?: string;
  initialError?: string | null;
  initialMode?: 'login' | 'register';
}

const MIN_WIDTH     = 320;
const MAX_WIDTH     = 620;
const DEFAULT_WIDTH = 440;

// ── Clases compartidas (sistema de diseño zinc) ──────────────────────────────
const labelCls = 'block text-[10px] uppercase tracking-[0.18em] font-black text-zinc-500';
const inputCls =
  'w-full bg-zinc-950 border border-zinc-800 rounded-md pl-10 pr-4 py-3 text-sm text-zinc-100 ' +
  'placeholder:text-zinc-600 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all';
const inputPwdCls = inputCls.replace('pr-4', 'pr-11');

export const LoginAside = ({
  isOpen,
  onClose,
  redirectAfter,
  initialError = null,
  initialMode = 'login',
}: LoginAsideProps) => {
  const [mode,         setMode]         = useState<'login' | 'register'>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [error,        setError]        = useState<string | null>(initialError);
  const [width,        setWidth]        = useState(DEFAULT_WIDTH);

  // ── Estado del login (incluye 2FA) ──────────────────────────────────────────
  const [step,        setStep]        = useState<'credentials' | 'totp'>('credentials');
  const [totpCode,    setTotpCode]    = useState('');
  const [totpLoading, setTotpLoading] = useState(false);
  const [savedCreds,  setSavedCreds]  = useState<{ email: string; password: string } | null>(null);

  // ── Estado del registro ─────────────────────────────────────────────────────
  const [registerOk,   setRegisterOk]   = useState(false);
  const [registerType, setRegisterType] = useState<'aprendiz' | 'instructor'>('aprendiz');

  const { login } = useAuth();

  const isDragging = useRef(false);
  const startX     = useRef(0);
  const startWidth = useRef(DEFAULT_WIDTH);

  const loginForm = useForm<LoginCredentials>({ defaultValues: { email: '', password: '' } });
  const regForm   = useForm<RegisterForm>({ defaultValues: { nombre: '', correo: '', contrasena: '', codigoFicha: '', jornada: 'mañana', documento: '' } });
  const instrForm = useForm<InstrRegisterForm>({ defaultValues: { nombre: '', correo: '', contrasena: '' } });

  // Sincronizar error / modo iniciales cuando se (re)abre el drawer
  useEffect(() => {
    if (isOpen) {
      setError(initialError);
      setMode(initialMode);
    } else {
      // Reset total al cerrar
      setError(null);
      setStep('credentials');
      setTotpCode('');
      setSavedCreds(null);
      setRegisterOk(false);
      setRegisterType('aprendiz');
      setShowPassword(false);
      loginForm.reset();
      regForm.reset();
      instrForm.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialError, initialMode]);

  // Al cambiar de modo, limpiar errores/estado de paso
  useEffect(() => {
    setError(null);
    setStep('credentials');
    setRegisterOk(false);
    setShowPassword(false);
  }, [mode]);

  // ── Drag-to-resize ──────────────────────────────────────────────────────────
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

  // ── Submit login (con manejo de 2FA) ────────────────────────────────────────
  const onLoginSubmit = async (data: LoginCredentials) => {
    try {
      setError(null);
      const result = await login(data.email, data.password, redirectAfter);
      if (result.requires2fa) {
        setSavedCreds({ email: data.email, password: data.password });
        setStep('totp');
        return;
      }
      onClose(); // login navega al dashboard; cerramos por si acaso
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Credenciales incorrectas. Intenta de nuevo.');
    }
  };

  const onTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!savedCreds || totpCode.length !== 6) return;
    try {
      setError(null);
      setTotpLoading(true);
      await login(savedCreds.email, savedCreds.password, redirectAfter, totpCode.trim());
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Código inválido. Intenta de nuevo.');
    } finally {
      setTotpLoading(false);
    }
  };

  // ── Submit registro ─────────────────────────────────────────────────────────
  const onRegisterSubmit = async (data: RegisterForm) => {
    try {
      setError(null);
      // Registro de aprendiz: crea la cuenta Y la solicitud de vinculación
      // (ficha + jornada) en un solo paso. El instructor recibe la solicitud.
      await authService.registerAprendiz({
        nombre:      data.nombre.trim(),
        correo:      data.correo.trim().toLowerCase(),
        contrasena:  data.contrasena,
        codigoFicha: data.codigoFicha.trim(),
        jornada:     data.jornada,
        documento:   data.documento.trim(),
      });
      setRegisterOk(true);
      regForm.reset();
      // Tras crear la cuenta, volver al login pasados unos segundos
      setTimeout(() => { setMode('login'); }, 5500);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo crear la cuenta. Intenta de nuevo.');
    }
  };

  const onInstrRegisterSubmit = async (data: InstrRegisterForm) => {
    try {
      setError(null);
      await authService.registerInstructor({
        nombre:     data.nombre.trim(),
        correo:     data.correo.trim().toLowerCase(),
        contrasena: data.contrasena,
      });
      setRegisterOk(true);
      instrForm.reset();
      setTimeout(() => { setMode('login'); }, 5500);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo crear la cuenta. Intenta de nuevo.');
    }
  };

  const goGoogle  = () => { window.location.href = '/api/auth/google'; };
  const goGithub  = () => { window.location.href = '/api/auth/github'; };

  // ── Botones OAuth reutilizables ──────────────────────────────────────────────
  const OAuthButtons = () => (
    <div className="space-y-2.5">
      {/* Google */}
      <button
        type="button"
        onClick={goGoogle}
        className="w-full flex items-center justify-center gap-2.5 py-2.5 bg-white hover:bg-zinc-100 text-zinc-800 text-sm font-bold rounded-md transition-all active:scale-[0.98]"
      >
        <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
          <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
          <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
          <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
        </svg>
        Continuar con Google
      </button>

      {/* GitHub */}
      <button
        type="button"
        onClick={goGithub}
        className="w-full flex items-center justify-center gap-2.5 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 text-white text-sm font-bold rounded-md transition-all active:scale-[0.98]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.73.083-.73 1.205.085 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.4 3-.405 1.02.005 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z"/>
        </svg>
        Continuar con GitHub
      </button>
    </div>
  );

  // ── Bloque de error reutilizable ─────────────────────────────────────────────
  const ErrorBox = () =>
    error ? (
      <div className="flex items-start gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-md text-rose-400 text-xs">
        <AlertCircle size={14} className="shrink-0 mt-0.5" />
        <span className="leading-relaxed">{error}</span>
      </div>
    ) : null;

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
        className={`fixed top-0 right-0 h-full z-[100] bg-zinc-950 border-l border-zinc-800 flex flex-col overflow-y-auto overflow-x-hidden shadow-[0_0_80px_rgba(0,0,0,0.8)] transition-[transform,opacity] duration-300 ease-in-out text-zinc-100 selection:bg-blue-600 selection:text-white ${
          isOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
        }`}
      >
        {/* Drag handle */}
        <div
          onMouseDown={onMouseDown}
          className="absolute left-0 top-0 h-full w-3 z-10 flex items-center justify-center cursor-ew-resize group"
          title="Arrastrar para redimensionar"
        >
          <div className="w-[3px] h-16 rounded-full bg-zinc-800 group-hover:bg-blue-500 transition-colors" />
          <GripVertical
            size={14}
            className="absolute text-zinc-700 group-hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100"
          />
        </div>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className=" overflow-hidden bg-zinc-900 border-b border-zinc-800  pb-2 md:px-8 shrink-0">
          {/* Anillos decorativos sutiles (zinc) */}
          <div className="absolute right-[-40px] top-[-30px] h-[150px] w-[200px] rounded-full border border-white/[0.03] pointer-events-none shadow" />
          <div className="absolute left-[-20px] bottom-[-20px] h-[80px] w-[120px] rounded-full border border-blue-500/[0.06] pointer-events-none" />

          {/* Cerrar */}
          <div className="flex justify-end mb-2 relative z-10 mt-2">
            <button
              onClick={onClose}
              className="p-2 text-zinc-500 hover:text-zinc-200 bg-zinc-800/60 border border-zinc-700 rounded-md transition-colors active:scale-95"
            >
              <X size={18} />
            </button>
          </div>

          {/* Logo animado */}
          <div className="gap-2 z-10 -mt-5 flex flex-row">
            <div>
            <KanbanaLogo size={60} iconBorder="ring-1 ring-zinc-700/80" />
            </div>
            <div className="text-left mt-2">
              <h1 className="text-2xl font-black tracking-[-0.05em] text-white">Kanbana</h1>
              <p className="text-xs text-zinc-500 font-medium mt-0.5">
                Sistema de gestión <span className="text-blue-400 font-bold">SENA · ADSO</span>
              </p>
            </div>
          </div>
        </div>

        <div className="pl-5 pr-6 pt-6 pb-8 md:pl-8 md:pr-8 flex flex-col gap-5 flex-1">

          {/* ════════ PASO 2FA ════════ */}
          {mode === 'login' && step === 'totp' ? (
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-md p-6 space-y-5 shadow-inner">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-md bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
                  <ShieldCheck size={22} className="text-blue-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">Verificación en dos pasos</h2>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Abre Google Authenticator y copia el código de 6 dígitos
                  </p>
                </div>
              </div>

              <ErrorBox />

              <form onSubmit={onTotpSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className={labelCls}>Código de autenticación</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoFocus
                    value={totpCode}
                    onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000 000"
                    className="w-full text-center text-2xl font-mono tracking-[0.35em] px-4 py-4 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100 placeholder:text-zinc-700 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all"
                  />
                  <p className="text-[10px] text-zinc-600 text-center">El código cambia cada 30 segundos</p>
                </div>

                <button
                  type="submit"
                  disabled={totpLoading || totpCode.length !== 6}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-black rounded-md transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]"
                >
                  {totpLoading
                    ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Verificando...</>
                    : <>Verificar <ArrowRight size={14} /></>}
                </button>
              </form>

              <div className="pt-3 border-t border-zinc-800">
                <button
                  onClick={() => { setStep('credentials'); setError(null); setTotpCode(''); }}
                  className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mx-auto"
                >
                  <ChevronLeft size={13} /> Volver al inicio de sesión
                </button>
              </div>
            </div>

          /* ════════ MODO LOGIN ════════ */
          ) : mode === 'login' ? (
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-md p-6 space-y-5 shadow-inner">
              <div>
                <h2 className="text-base font-bold tracking-tight text-white">Iniciar sesión</h2>
                <p className="text-[11px] text-zinc-500 mt-0.5">Ingresa con tus credenciales del programa formativo.</p>
              </div>

              <ErrorBox />

              <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                {/* Email */}
                <div className="space-y-1.5">
                  <label className={labelCls}>Correo electrónico</label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                    <input
                      {...loginForm.register('email', {
                        required: 'El correo es obligatorio',
                        pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Formato inválido' },
                      })}
                      type="email"
                      placeholder="ejemplo@sena.edu.co"
                      className={inputCls}
                    />
                  </div>
                  {loginForm.formState.errors.email &&
                    <p className="text-[11px] text-rose-400 ml-1">{loginForm.formState.errors.email.message}</p>}
                </div>

                {/* Contraseña */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className={labelCls}>Contraseña</label>
                    <Link
                      to="/forgot-password"
                      className="text-[10px] font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                      onClick={onClose}
                    >
                      ¿Olvidaste tu contraseña?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                    <input
                      {...loginForm.register('password', { required: 'La contraseña es obligatoria' })}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className={inputPwdCls}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {loginForm.formState.errors.password &&
                    <p className="text-[11px] text-rose-400 ml-1">{loginForm.formState.errors.password.message}</p>}
                </div>

                <button
                  type="submit"
                  disabled={loginForm.formState.isSubmitting}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:pointer-events-none text-white text-sm font-black rounded-md transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]"
                >
                  {loginForm.formState.isSubmitting
                    ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Verificando...</>
                    : <>Iniciar sesión <ArrowRight size={14} /></>}
                </button>
              </form>

              {/* Separador */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-zinc-800" />
                <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">o</span>
                <div className="flex-1 h-px bg-zinc-800" />
              </div>

              <OAuthButtons />

              <p className="text-xs text-zinc-400 text-center pt-1">
                ¿Eres aprendiz nuevo?{' '}
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="text-blue-400 hover:text-blue-300 font-bold transition-colors"
                >
                  Regístrate aquí
                </button>
              </p>
            </div>

          /* ════════ MODO REGISTRO ════════ */
          ) : (
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-md p-6 space-y-5 shadow-inner">

              {/* Toggle Aprendiz / Instructor */}
              <div className="flex rounded-md overflow-hidden border border-zinc-700 p-0.5 bg-zinc-900 gap-0.5">
                <button
                  type="button"
                  onClick={() => { setRegisterType('aprendiz'); setError(null); setRegisterOk(false); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-black rounded transition-all ${
                    registerType === 'aprendiz'
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <GraduationCap size={13} /> Soy aprendiz
                </button>
                <button
                  type="button"
                  onClick={() => { setRegisterType('instructor'); setError(null); setRegisterOk(false); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-black rounded transition-all ${
                    registerType === 'instructor'
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <BookOpen size={13} /> Soy instructor
                </button>
              </div>

              <div>
                <h2 className="text-base font-bold tracking-tight text-white">
                  {registerType === 'aprendiz' ? 'Registro de aprendiz' : 'Registro de instructor'}
                </h2>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  {registerType === 'aprendiz'
                    ? 'Crea tu cuenta y solicita unirte a tu ficha en un paso.'
                    : 'Usa tu correo institucional SENA. Te llegará un correo de confirmación.'}
                </p>
              </div>

              <ErrorBox />

              {registerOk && (
                <div className="flex items-start gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-emerald-400 text-xs">
                  <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                  <span className="leading-relaxed">
                    {registerType === 'aprendiz'
                      ? '¡Cuenta creada! Te enviamos un correo de confirmación. Al confirmarlo, tu solicitud de vinculación quedará activa.'
                      : '¡Cuenta creada! Revisa tu correo SENA y confirma tu cuenta para poder iniciar sesión.'}
                  </span>
                </div>
              )}

              {/* ════════ FORMULARIO APRENDIZ ════════ */}
              {registerType === 'aprendiz' && (
                <form onSubmit={regForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className={labelCls}>Nombre</label>
                    <div className="relative">
                      <UserIcon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                      <input
                        {...regForm.register('nombre', {
                          required: 'Campo obligatorio',
                          minLength: { value: 3, message: 'Mínimo 3 caracteres' },
                        })}
                        type="text"
                        placeholder="Nombre completo"
                        className={inputCls}
                      />
                    </div>
                    {regForm.formState.errors.nombre &&
                      <p className="text-[11px] text-rose-400 ml-1">{regForm.formState.errors.nombre.message}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelCls}>Correo electrónico</label>
                    <div className="relative">
                      <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                      <input
                        {...regForm.register('correo', {
                          required: 'Campo obligatorio',
                          pattern: {
                            value: /^[a-z0-9](\.?[a-z0-9]){5,29}@(gmail|googlemail)\.com$/i,
                            message: 'No se pudo encontrar tu cuenta de Google',
                          },
                        })}
                        type="email"
                        placeholder="ejemplo@gmail.com"
                        className={inputCls}
                      />
                    </div>
                    {regForm.formState.errors.correo
                      ? <p className="text-[11px] text-rose-400 ml-1">{regForm.formState.errors.correo.message}</p>
                      : <p className="text-[11px] text-zinc-600 ml-1">Debe ser un correo de Google (@gmail.com).</p>}
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelCls}>Contraseña</label>
                    <div className="relative">
                      <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                      <input
                        {...regForm.register('contrasena', {
                          required: 'Campo obligatorio',
                          validate: (v: string) => {
                            if (v.length < 7)     return 'Mínimo 7 caracteres';
                            if (!/[A-Z]/.test(v)) return 'Incluye al menos una letra mayúscula';
                            if (!/[0-9]/.test(v)) return 'Incluye al menos un número';
                            return true;
                          },
                        })}
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Mín. 7, una mayúscula y un número"
                        className={inputPwdCls}
                      />
                      <button type="button" onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors">
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    {regForm.formState.errors.contrasena
                      ? <p className="text-[11px] text-rose-400 ml-1">{regForm.formState.errors.contrasena.message}</p>
                      : <p className="text-[11px] text-zinc-600 ml-1">Mínimo 7 caracteres, una mayúscula y un número.</p>}
                  </div>

                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/[0.04] p-3 space-y-3">
                    <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-blue-400">
                      <Layers size={12} /> Vinculación a tu ficha
                    </p>
                    <div className="space-y-1.5">
                      <label className={labelCls}>Código de la ficha</label>
                      <div className="relative">
                        <Layers size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                        <input
                          {...regForm.register('codigoFicha', { required: 'Campo obligatorio' })}
                          type="text"
                          placeholder="Ej: 2826503"
                          className={inputCls}
                        />
                      </div>
                      {regForm.formState.errors.codigoFicha &&
                        <p className="text-[11px] text-rose-400 ml-1">{regForm.formState.errors.codigoFicha.message}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className={labelCls}>Jornada</label>
                        <div className="relative">
                          <Clock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600 z-10" />
                          <select {...regForm.register('jornada', { required: true })} className={inputCls}>
                            <option value="mañana">Mañana</option>
                            <option value="tarde">Tarde</option>
                            <option value="noche">Noche</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className={labelCls}>Documento</label>
                        <div className="relative">
                          <Hash size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                          <input
                            {...regForm.register('documento', { required: 'Campo obligatorio' })}
                            type="text"
                            inputMode="numeric"
                            placeholder="N° documento"
                            className={inputCls}
                          />
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-zinc-500 ml-0.5">
                      Tu instructor recibirá la solicitud y deberá aprobarla para que ingreses a la ficha.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={regForm.formState.isSubmitting || registerOk}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-black rounded-md transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]"
                  >
                    {regForm.formState.isSubmitting
                      ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creando cuenta...</>
                      : 'Crear cuenta y solicitar vinculación'}
                  </button>
                </form>
              )}

              {/* ════════ FORMULARIO INSTRUCTOR ════════ */}
              {registerType === 'instructor' && (
                <form onSubmit={instrForm.handleSubmit(onInstrRegisterSubmit)} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className={labelCls}>Nombre</label>
                    <div className="relative">
                      <UserIcon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                      <input
                        {...instrForm.register('nombre', {
                          required: 'Campo obligatorio',
                          minLength: { value: 3, message: 'Mínimo 3 caracteres' },
                        })}
                        type="text"
                        placeholder="Nombre completo"
                        className={inputCls}
                      />
                    </div>
                    {instrForm.formState.errors.nombre &&
                      <p className="text-[11px] text-rose-400 ml-1">{instrForm.formState.errors.nombre.message}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelCls}>Correo institucional SENA</label>
                    <div className="relative">
                      <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                      <input
                        {...instrForm.register('correo', {
                          required: 'Campo obligatorio',
                          pattern: {
                            value: /^[^\s@]+@sena\.edu\.co$/i,
                            message: 'Debe terminar en @sena.edu.co',
                          },
                        })}
                        type="email"
                        placeholder="nombre@sena.edu.co"
                        className={inputCls}
                      />
                    </div>
                    {instrForm.formState.errors.correo
                      ? <p className="text-[11px] text-rose-400 ml-1">{instrForm.formState.errors.correo.message}</p>
                      : <p className="text-[11px] text-zinc-600 ml-1">Solo se aceptan correos institucionales @sena.edu.co.</p>}
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelCls}>Contraseña</label>
                    <div className="relative">
                      <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                      <input
                        {...instrForm.register('contrasena', {
                          required: 'Campo obligatorio',
                          validate: (v: string) => {
                            if (v.length < 7)     return 'Mínimo 7 caracteres';
                            if (!/[A-Z]/.test(v)) return 'Incluye al menos una letra mayúscula';
                            if (!/[0-9]/.test(v)) return 'Incluye al menos un número';
                            return true;
                          },
                        })}
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Mín. 7, una mayúscula y un número"
                        className={inputPwdCls}
                      />
                      <button type="button" onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors">
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    {instrForm.formState.errors.contrasena
                      ? <p className="text-[11px] text-rose-400 ml-1">{instrForm.formState.errors.contrasena.message}</p>
                      : <p className="text-[11px] text-zinc-600 ml-1">Mínimo 7 caracteres, una mayúscula y un número.</p>}
                  </div>

                  <button
                    type="submit"
                    disabled={instrForm.formState.isSubmitting || registerOk}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-black rounded-md transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]"
                  >
                    {instrForm.formState.isSubmitting
                      ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creando cuenta...</>
                      : 'Crear cuenta de instructor'}
                  </button>
                </form>
              )}

              {/* Separador + OAuth solo para aprendices */}
              {registerType === 'aprendiz' && (
                <>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-zinc-800" />
                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">o</span>
                    <div className="flex-1 h-px bg-zinc-800" />
                  </div>
                  <OAuthButtons />
                </>
              )}

              <p className="text-xs text-zinc-400 text-center pt-1">
                ¿Ya tienes cuenta?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-blue-400 hover:text-blue-300 font-bold transition-colors"
                >
                  Inicia sesión
                </button>
              </p>
            </div>
          )}

          {/* Dev hint */}
          {import.meta.env.DEV && mode === 'login' && step === 'credentials' && (
            <div className="p-3 bg-zinc-900 border border-zinc-800/60 rounded-md">
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
