import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import api from '../services/api';

export const ConfirmarCuentaPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
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
        setMessage('Tu cuenta ha sido confirmada. Ya puedes iniciar sesión con tu cédula como contraseña.');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err?.response?.data?.message || 'El enlace es inválido o ya fue utilizado.');
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-dark-card border border-dark-border rounded-2xl p-8 text-center shadow-2xl">
        <p className="text-xs font-bold tracking-[4px] uppercase text-primary-400 mb-6">KANBANA</p>

        {status === 'loading' && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 size={40} className="text-primary-400 animate-spin" />
            <p className="text-dark-muted text-sm">Verificando tu cuenta...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} className="text-emerald-400" />
            </div>
            <h1 className="text-xl font-bold text-dark-text">¡Cuenta confirmada!</h1>
            <p className="text-sm text-dark-muted leading-relaxed">{message}</p>
            <Link
              to="/login"
              className="mt-2 inline-block px-6 py-2.5 bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Ir a iniciar sesión
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto">
              <AlertCircle size={32} className="text-rose-400" />
            </div>
            <h1 className="text-xl font-bold text-dark-text">Enlace inválido</h1>
            <p className="text-sm text-dark-muted leading-relaxed">{message}</p>
            <Link
              to="/login"
              className="mt-2 inline-block px-6 py-2.5 border border-dark-border hover:border-primary-500/40 text-dark-muted hover:text-dark-text text-sm font-semibold rounded-xl transition-colors"
            >
              Volver al inicio
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
