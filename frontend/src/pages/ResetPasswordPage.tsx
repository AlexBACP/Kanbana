import { useState } from 'react';
import { useForm } from 'react-hook-form';
// ── CAMBIO: leemos el token de la URL con useSearchParams ────────────────
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { Button } from '../components/Button';
import api from '../services/api';

interface FormData {
  newPassword: string;
  confirmPassword: string;
}

export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // ── CAMBIO: el token viene como ?token=xxx en la URL del email ──────────
  const token = searchParams.get('token');

  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPass, setShowPass]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { isSubmitting, errors },
  } = useForm<FormData>();

  // Si no hay token en la URL, mostramos error inmediatamente
  if (!token) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 text-center">
          <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Enlace inválido</h2>
          <p className="text-gray-500 text-sm mb-6">
            Este enlace de recuperación no es válido o ya fue utilizado.
          </p>
          <Link to="/forgot-password">
            <Button className="w-full">Solicitar nuevo enlace</Button>
          </Link>
        </div>
      </div>
    );
  }

  const onSubmit = async (data: FormData) => {
    try {
      setError(null);
      // ── CAMBIO: enviamos token + nueva contraseña al backend ────────────
      await api.post('/auth/reset-password', {
        token,
        newPassword: data.newPassword,
      });
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

  if (success) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 text-center">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">¡Contraseña actualizada!</h2>
          <p className="text-gray-500 text-sm mb-6">
            Tu contraseña fue cambiada exitosamente. Ya puedes iniciar sesión.
          </p>
          {/* ── CAMBIO: redirige al login luego de 2s o al hacer click ──── */}
          <Button className="w-full" onClick={() => navigate('/login')}>
            Ir al Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
        <div className="mb-8">
          <Link to="/login" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-primary-600 transition-colors mb-6">
            <ArrowLeft size={16} />
            Volver al login
          </Link>
          <h2 className="text-2xl font-bold text-gray-900">Nueva contraseña</h2>
          <p className="text-gray-500 mt-2">Elige una contraseña segura para tu cuenta.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-700 text-sm">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div>
              <p>{error}</p>
              {error.includes('expirado') && (
                <Link to="/forgot-password" className="underline font-semibold mt-1 inline-block">
                  Solicitar nuevo enlace
                </Link>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

          {/* ── Campo nueva contraseña ─────────────────────────────── */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Nueva contraseña
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-primary-500 transition-colors">
                <Lock size={18} />
              </div>
              <input
                {...register('newPassword', {
                  required: 'La contraseña es obligatoria',
                  minLength: { value: 8, message: 'Mínimo 8 caracteres' },
                })}
                type={showPass ? 'text' : 'password'}
                placeholder="Mínimo 8 caracteres"
                className="block w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all"
              />
              {/* ── Toggle para mostrar/ocultar contraseña */}
              <button
                type="button"
                onClick={() => setShowPass(p => !p)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.newPassword && (
              <p className="mt-1 text-xs text-red-600">{errors.newPassword.message}</p>
            )}
          </div>

          {/* ── Campo confirmar contraseña ─────────────────────────── */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Confirmar contraseña
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-primary-500 transition-colors">
                <Lock size={18} />
              </div>
              <input
                {...register('confirmPassword', {
                  required: 'Confirma tu contraseña',
                  // ── CAMBIO: validación de que ambas contraseñas coincidan
                  validate: val =>
                    val === watch('newPassword') || 'Las contraseñas no coinciden',
                })}
                type={showConfirm ? 'text' : 'password'}
                placeholder="Repite la contraseña"
                className="block w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(p => !p)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600"
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full py-3 text-sm font-bold shadow-lg shadow-primary-500/20"
            isLoading={isSubmitting}
          >
            {isSubmitting ? 'Actualizando...' : 'Actualizar contraseña'}
          </Button>
        </form>
      </div>
    </div>
  );
};