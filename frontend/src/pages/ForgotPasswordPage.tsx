import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { Mail, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/Button';
import api from '../services/api';

export const ForgotPasswordPage = () => {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm({
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: { email: string }) => {
    try {
      setError(null);
      await api.post('/auth/forgot-password', { email: data.email });
      setSuccess(true);
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'No pudimos procesar tu solicitud. Verifica el correo.'
      );
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
        <div className="mb-8">
          <Link to="/login" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-primary-600 transition-colors mb-6">
            <ArrowLeft size={16} />
            Volver al login
          </Link>
          <h2 className="text-2xl font-bold text-gray-900">Recuperar Contraseña</h2>
          <p className="text-gray-500 mt-2">Ingresa tu correo para recibir un enlace de recuperación.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-700 text-sm">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {success ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">¡Correo Enviado!</h3>
            <p className="text-gray-500 text-sm mb-6">
              Si el correo existe en nuestra base de datos, recibirás un enlace válido por 30 minutos.
            </p>
            <Link to="/login">
              <Button variant="secondary" className="w-full">Regresar al Login</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Correo Electrónico</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-primary-500 transition-colors">
                  <Mail size={18} />
                </div>
                <input
                  {...register('email', { 
                    required: 'El correo es obligatorio',
                    pattern: { value: /^\S+@\S+$/i, message: 'Correo inválido' }
                  })}
                  type="email"
                  placeholder="ejemplo@sena.edu.co"
                  className="block w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full py-3 text-sm font-bold shadow-lg shadow-primary-500/20"
              isLoading={isSubmitting}
            >
              Enviar Enlace
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};
