import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { userService } from '../services/user.service';
import { CreateUserDto, UserRole } from '../types/user.types';

export const RegisterPage = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserDto>({
    defaultValues: { nombre: '', correo: '', contrasena: '', rol: 'aprendiz' as UserRole },
  });

  const onSubmit = async (data: CreateUserDto) => {
    try {
      setError(null);
      await userService.create({ ...data, rol: 'aprendiz' as UserRole });
      setSuccess(true);
      // Si esta página fue abierta como ventana nueva (popup), notificar a la ventana padre
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: 'REGISTER_SUCCESS' }, window.location.origin);
        setTimeout(() => window.close(), 1500);
      } else {
        setTimeout(() => navigate('/login'), 1500);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error al crear la cuenta. Intenta con otro correo.');
    }
  };

  return (
    <div className="w-full max-w-sm animate-in">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-600 rounded-xl mb-4">
          <span className="text-xl font-bold text-white">K</span>
        </div>
        <h1 className="text-xl font-semibold text-ink-primary">Kanbana</h1>
        <p className="text-sm text-ink-secondary mt-1">Sistema de gestión SENA · ADSO</p>
      </div>

      <div className="card p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-ink-primary">Crear cuenta</h2>
          <p className="text-xs text-ink-secondary mt-0.5">Las cuentas nuevas ingresan como aprendices</p>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-danger-light border border-danger-border rounded-lg text-danger text-sm">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-2 p-3 bg-success-light border border-success-border rounded-lg text-success text-sm">
            <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
            <span>¡Cuenta creada! {window.opener ? 'Cerrando ventana...' : 'Redirigiendo al login...'}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Nombre */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-ink-secondary">Nombre completo</label>
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                {...register('nombre', { required: 'Campo obligatorio' })}
                type="text"
                placeholder="Tu nombre completo"
                className={`input-base pl-9 ${errors.nombre ? 'border-danger' : ''}`}
              />
            </div>
            {errors.nombre && <p className="text-xs text-danger">{errors.nombre.message}</p>}
          </div>

          {/* Correo */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-ink-secondary">Correo electrónico</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                {...register('correo', {
                  required: 'Campo obligatorio',
                  pattern: { value: /^\S+@\S+$/i, message: 'Correo inválido' },
                })}
                type="email"
                placeholder="ejemplo@sena.edu.co"
                className={`input-base pl-9 ${errors.correo ? 'border-danger' : ''}`}
              />
            </div>
            {errors.correo && <p className="text-xs text-danger">{errors.correo.message}</p>}
          </div>

          {/* Contraseña */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-ink-secondary">Contraseña</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                {...register('contrasena', {
                  required: 'Campo obligatorio',
                  minLength: { value: 6, message: 'Mínimo 6 caracteres' },
                })}
                type="password"
                placeholder="Mínimo 6 caracteres"
                className={`input-base pl-9 ${errors.contrasena ? 'border-danger' : ''}`}
              />
            </div>
            {errors.contrasena && <p className="text-xs text-danger">{errors.contrasena.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || success}
            className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creando cuenta...
              </>
            ) : (
              'Crear cuenta'
            )}
          </button>
        </form>

        <p className="text-xs text-ink-secondary text-center">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-primary-400 hover:text-primary-300 transition-colors font-medium">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
};
