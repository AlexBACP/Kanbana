/**
 * SolicitarVinculacionPage — pantalla para aprendices auto-registrados.
 *
 * Se muestra automáticamente cuando un aprendiz autenticado:
 *  - No tiene fichaId
 *  - vinculacion_estado !== 'pendiente'
 *
 * Si el estado es 'pendiente' o 'rechazado', muestra una pantalla informativa
 * en lugar del formulario.
 */
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  GraduationCap, Hash, Loader2, AlertCircle, CheckCircle2,
  Clock, XCircle, ArrowLeft, LogOut,
} from 'lucide-react';
import { useAuthStore }  from '../store/auth.store';
import { userService }   from '../services/user.service';
import { authService }   from '../services/auth.service';
import { useAuth }       from '../hooks/useAuth';
import { KanbanaLogo }   from '../components/KanbanaLogo';

const JORNADAS = [
  { key: 'mañana' as const, label: 'Mañana', emoji: '🌅', horario: '6:00 - 12:00' },
  { key: 'tarde'  as const, label: 'Tarde',  emoji: '☀️', horario: '12:00 - 18:00' },
  { key: 'noche'  as const, label: 'Noche',  emoji: '🌙', horario: '18:00 - 22:00' },
];

export const SolicitarVinculacionPage = () => {
  const { user, setUser } = useAuthStore();
  const { logout } = useAuth();

  const [codigoFicha, setCodigoFicha] = useState('');
  const [jornada,     setJornada]     = useState<'mañana' | 'tarde' | 'noche'>('mañana');
  const [documento,   setDocumento]   = useState(user?.documento ?? '');
  const [error,       setError]       = useState<string | null>(null);

  const estado = user?.vinculacion_estado;
  const motivoRechazo = user?.vinculacion_motivo_rechazo;

  const mutation = useMutation({
    mutationFn: () => userService.solicitarVinculacion({
      codigoFicha: codigoFicha.trim(),
      jornada,
      documento: documento.trim(),
    }),
    onSuccess: async () => {
      // Refrescar el user para reflejar el nuevo estado
      const refreshed = await authService.me();
      setUser(refreshed);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg || 'Error al enviar la solicitud'));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!codigoFicha.trim()) { setError('Debes indicar el código de tu ficha.'); return; }
    if (!documento.trim())   { setError('Debes indicar tu número de documento.'); return; }
    if (documento.trim().length < 5) { setError('El documento parece muy corto. Verifica.'); return; }

    mutation.mutate();
  };

  // ── Estado: pendiente ──────────────────────────────────────────────────
  if (estado === 'pendiente') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl overflow-hidden">
          <div className="flex justify-center pt-8">
            <KanbanaLogo size={60} iconBorder="ring-1 ring-zinc-700/80" />
          </div>
          <div className="p-8 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Clock size={28} className="text-amber-400" />
            </div>
            <h2 className="text-[18px] font-black text-white mb-1">Solicitud en revisión</h2>
            <p className="text-[13px] text-zinc-400 mb-6 leading-relaxed">
              Tu solicitud para unirte a la ficha está esperando aprobación del instructor.
              Te enviaremos una notificación cuando sea aprobada.
            </p>
            <div className="px-4 py-3 bg-zinc-800/60 border border-zinc-700 rounded-md mb-6">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Cuenta</p>
              <p className="text-[13px] text-zinc-200 font-bold">{user?.nombre}</p>
              <p className="text-[11px] text-zinc-500">{user?.correo}</p>
            </div>
            <button
              onClick={logout}
              className="flex items-center justify-center gap-2 mx-auto px-4 py-2 text-[12px] font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
            >
              <LogOut size={13} /> Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Form principal (incluye estado 'none' y 'rechazado') ───────────────
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl overflow-hidden">

        {/* Logo */}
        <div className="flex justify-center pt-8 pb-2">
          <KanbanaLogo size={60} iconBorder="ring-1 ring-zinc-700/80" />
        </div>

        {/* Header */}
        <div className="px-8 pb-5 text-center">
          <h1 className="text-[20px] font-black text-white tracking-tight">¡Bienvenido a Kanbana!</h1>
          <p className="text-[12px] text-zinc-500 mt-1">
            {user?.nombre} · {user?.correo}
          </p>
        </div>

        {/* Aviso rechazo previo */}
        {estado === 'rechazado' && motivoRechazo && (
          <div className="mx-8 mb-5 px-4 py-3 bg-rose-500/8 border border-rose-500/25 rounded-md">
            <div className="flex items-start gap-2">
              <XCircle size={14} className="text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[12px] font-black text-rose-400 mb-0.5">Tu solicitud anterior fue rechazada</p>
                <p className="text-[11px] text-rose-300/80 leading-relaxed">{motivoRechazo}</p>
                <p className="text-[10px] text-rose-400/60 mt-1.5">Puedes solicitar otra ficha. Si crees que es un error, contacta al coordinador.</p>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-5">
          <div className="border-t border-zinc-800 pt-5">
            <p className="text-[11px] font-black text-blue-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
              <GraduationCap size={11} /> Vinculación a una ficha
            </p>
            <p className="text-[12px] text-zinc-500 leading-relaxed">
              Indica los datos de tu ficha. Tu instructor verá la solicitud y la aprobará para que puedas trabajar en el sistema.
            </p>
          </div>

          {/* Código de ficha */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">Código de la ficha</label>
            <div className="relative">
              <Hash size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
              <input
                value={codigoFicha}
                onChange={e => setCodigoFicha(e.target.value)}
                placeholder="Ej: 2814392"
                required
                className="w-full bg-zinc-950 border border-zinc-700 rounded-md pl-9 pr-3 py-2.5 text-[13px] text-zinc-100 outline-none hover:bg-zinc-900 focus:bg-zinc-900 focus:border-blue-500 transition-colors placeholder-zinc-600"
                autoFocus
              />
            </div>
            <p className="text-[10px] text-zinc-600">El instructor debió compartírtelo.</p>
          </div>

          {/* Jornada */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">Tu jornada</label>
            <div className="grid grid-cols-3 gap-2">
              {JORNADAS.map(j => {
                const active = jornada === j.key;
                return (
                  <button
                    type="button"
                    key={j.key}
                    onClick={() => setJornada(j.key)}
                    className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-md border text-center transition-all ${
                      active
                        ? 'bg-blue-500/15 border-blue-500/40 text-blue-300 shadow-md shadow-blue-900/30'
                        : 'bg-zinc-800/40 border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:bg-zinc-800'
                    }`}
                  >
                    <span className="text-[16px]">{j.emoji}</span>
                    <span className="text-[11px] font-black uppercase tracking-widest">{j.label}</span>
                    <span className="text-[9px] text-zinc-500">{j.horario}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-zinc-600">Debe coincidir con la jornada de la ficha.</p>
          </div>

          {/* Documento */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">Número de documento</label>
            <div className="relative">
              <Hash size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
              <input
                value={documento}
                onChange={e => setDocumento(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Ej: 1234567890"
                required
                inputMode="numeric"
                className="w-full bg-zinc-950 border border-zinc-700 rounded-md pl-9 pr-3 py-2.5 text-[13px] text-zinc-100 outline-none hover:bg-zinc-900 focus:bg-zinc-900 focus:border-blue-500 transition-colors placeholder-zinc-600"
              />
            </div>
            <p className="text-[10px] text-zinc-600">El instructor te identificará por tu documento. Solo números, sin puntos ni espacios.</p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-rose-500/10 border border-rose-500/25 rounded-md">
              <AlertCircle size={13} className="text-rose-400 shrink-0 mt-0.5" />
              <p className="text-[12px] text-rose-400 leading-relaxed">{error}</p>
            </div>
          )}

          {/* Botones */}
          <div className="flex items-center gap-3 pt-2 border-t border-zinc-800">
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-bold text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition-colors"
            >
              <ArrowLeft size={12} /> Cerrar sesión
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-[13px] font-black rounded-md transition-all"
            >
              {mutation.isPending
                ? <><Loader2 size={13} className="animate-spin" /> Enviando…</>
                : <><CheckCircle2 size={13} /> Enviar solicitud</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
