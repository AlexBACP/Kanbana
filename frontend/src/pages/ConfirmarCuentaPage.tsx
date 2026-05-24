import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Loader2, LogIn } from 'lucide-react';
import api from '../services/api';

export const ConfirmarCuentaPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [status,  setStatus]  = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No se encontró un token de confirmación en el enlace.');
      return;
    }

    api.post('/auth/confirm-account', { token })
      .then(() => {
        setStatus('success');
        setMessage('Tu cuenta ha sido confirmada. Ya puedes iniciar sesión con tu número de documento como contraseña temporal.');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err?.response?.data?.message || 'El enlace es inválido o ya fue utilizado.');
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-700/60 rounded-2xl p-8 text-center shadow-2xl shadow-black/60">

        {/* Marca */}
        <p className="text-xs font-black tracking-[4px] uppercase text-cyan-400 mb-6">KANBANA</p>

        {/* Estado: cargando */}
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto">
              <Loader2 size={30} className="text-cyan-400 animate-spin" />
            </div>
            <p className="text-zinc-400 text-sm">Verificando tu cuenta…</p>
          </div>
        )}

        {/* Estado: éxito */}
        {status === 'success' && (
          <div className="flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} className="text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-black text-zinc-100 tracking-tight">¡Cuenta activada!</h1>
              <p className="text-sm text-zinc-400 leading-relaxed mt-2">{message}</p>
            </div>

            {/* Recordatorio de credenciales */}
            <div className="w-full bg-zinc-950 border border-zinc-700/60 rounded-md px-4 py-3 text-left">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">
                Primer acceso
              </p>
              <p className="text-[12px] text-zinc-400 leading-relaxed">
                Usa tu <span className="font-bold text-zinc-200">correo electrónico</span> y tu{' '}
                <span className="font-bold text-cyan-400">número de documento</span> como contraseña temporal.
                Podrás cambiarla desde tu perfil.
              </p>
            </div>

            <Link
              to="/login"
              className="mt-1 w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-black rounded-xl transition-colors active:scale-95"
            >
              <LogIn size={15} /> Ir a iniciar sesión
            </Link>
          </div>
        )}

        {/* Estado: error */}
        {status === 'error' && (
          <div className="flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto">
              <AlertCircle size={32} className="text-rose-400" />
            </div>
            <div>
              <h1 className="text-xl font-black text-zinc-100 tracking-tight">Enlace inválido</h1>
              <p className="text-sm text-zinc-400 leading-relaxed mt-2">{message}</p>
            </div>
            <Link
              to="/login"
              className="mt-1 w-full inline-flex items-center justify-center gap-2 px-6 py-3 border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-100 text-sm font-bold rounded-xl transition-colors"
            >
              Volver al inicio de sesión
            </Link>
          </div>
        )}

      </div>
    </div>
  );
};
