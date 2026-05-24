/**
 * TwoFactorModal — Configuración de autenticación en dos pasos (TOTP)
 *
 * Flujos:
 *  • 2FA desactivado → mostrar QR → usuario escanea → ingresa código → activa
 *  • 2FA activado    → usuario ingresa código → desactiva
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ShieldCheck, ShieldOff, Shield, Copy, Check,
  Smartphone, AlertCircle, CheckCircle2, Loader2,
} from 'lucide-react';
import { authService } from '../services/auth.service';

interface Props {
  onClose: () => void;
}

export const TwoFactorModal = ({ onClose }: Props) => {
  const qc = useQueryClient();

  // ── Estado interno ──────────────────────────────────────────────────────────
  const [innerStep, setInnerStep] = useState<'idle' | 'qr' | 'confirm' | 'disable'>('idle');
  const [code,      setCode]      = useState('');
  const [copied,    setCopied]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [done,      setDone]      = useState<'enabled' | 'disabled' | null>(null);

  // ── Queries / Mutations ─────────────────────────────────────────────────────
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['2fa-status'],
    queryFn:  authService.get2faStatus,
  });

  const setupMut = useMutation({
    mutationFn: authService.setup2fa,
    onSuccess: () => setInnerStep('qr'),
    onError: (e: any) => setError(e?.response?.data?.message ?? 'Error al generar el QR'),
  });

  const enableMut = useMutation({
    mutationFn: (code: string) => authService.enable2fa(code),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['2fa-status'] });
      setDone('enabled');
    },
    onError: (e: any) => setError(e?.response?.data?.message ?? 'Código inválido'),
  });

  const disableMut = useMutation({
    mutationFn: (code: string) => authService.disable2fa(code),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['2fa-status'] });
      setDone('disabled');
    },
    onError: (e: any) => setError(e?.response?.data?.message ?? 'Código inválido'),
  });

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const copySecret = () => {
    if (setupMut.data?.secret) {
      navigator.clipboard.writeText(setupMut.data.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleEnable = () => {
    setError(null);
    if (code.length !== 6) { setError('El código debe tener 6 dígitos'); return; }
    enableMut.mutate(code);
  };

  const handleDisable = () => {
    setError(null);
    if (code.length !== 6) { setError('El código debe tener 6 dígitos'); return; }
    disableMut.mutate(code);
  };

  const reset = () => {
    setInnerStep('idle');
    setCode('');
    setError(null);
    setDone(null);
  };

  const isEnabled = status?.enabled;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isEnabled ? 'bg-emerald-500/15' : 'bg-zinc-800'
            }`}>
              <Shield size={15} className={isEnabled ? 'text-emerald-400' : 'text-zinc-500'} />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-100">Autenticación en dos pasos</p>
              <p className="text-[10px] text-zinc-500">Google Authenticator / Authy</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5">
          {statusLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={24} className="text-zinc-600 animate-spin" />
            </div>
          ) : done ? (
            // ── Pantalla de éxito ─────────────────────────────────────────────
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-base font-bold text-zinc-100">
                  {done === 'enabled' ? '2FA activado correctamente' : '2FA desactivado'}
                </p>
                <p className="text-sm text-zinc-500 mt-1">
                  {done === 'enabled'
                    ? 'Desde ahora necesitarás tu app de autenticación al iniciar sesión.'
                    : 'Tu cuenta ya no requiere código adicional al iniciar sesión.'}
                </p>
              </div>
              <div className="flex gap-2 justify-center pt-2">
                <button
                  onClick={reset}
                  className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-600 rounded-lg transition-all"
                >
                  Volver
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg transition-all"
                >
                  Cerrar
                </button>
              </div>
            </div>
          ) : innerStep === 'idle' ? (
            // ── Estado actual ─────────────────────────────────────────────────
            <div className="space-y-5">
              <div className={`flex items-center gap-3 p-4 rounded-xl border ${
                isEnabled
                  ? 'bg-emerald-500/8 border-emerald-500/20'
                  : 'bg-zinc-800/50 border-zinc-700'
              }`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isEnabled ? 'bg-emerald-500/20' : 'bg-zinc-700'
                }`}>
                  {isEnabled
                    ? <ShieldCheck size={18} className="text-emerald-400" />
                    : <ShieldOff size={18} className="text-zinc-500" />}
                </div>
                <div>
                  <p className={`text-sm font-bold ${isEnabled ? 'text-emerald-300' : 'text-zinc-300'}`}>
                    {isEnabled ? 'Activado' : 'Desactivado'}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {isEnabled
                      ? 'Tu cuenta está protegida con 2FA'
                      : 'Agrega una capa extra de seguridad a tu cuenta'}
                  </p>
                </div>
              </div>

              {isEnabled ? (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-500">
                    Para desactivar el 2FA necesitarás confirmar con un código de tu app de autenticación.
                  </p>
                  <button
                    onClick={() => { setInnerStep('disable'); setCode(''); setError(null); }}
                    className="w-full py-2.5 text-sm font-bold text-rose-400 border border-rose-500/30 hover:bg-rose-500/10 rounded-lg transition-all"
                  >
                    Desactivar autenticación en dos pasos
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2 text-xs text-zinc-500">
                    <div className="flex items-start gap-2">
                      <Smartphone size={13} className="shrink-0 mt-0.5 text-zinc-400" />
                      <span>Instala <strong className="text-zinc-300">Google Authenticator</strong> o <strong className="text-zinc-300">Authy</strong> en tu móvil</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="shrink-0 w-[13px] text-center text-zinc-400">▣</span>
                      <span>Escanea el código QR que aparecerá a continuación</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="shrink-0 w-[13px] text-center text-zinc-400">#</span>
                      <span>Ingresa el código de 6 dígitos para confirmar</span>
                    </div>
                  </div>
                  <button
                    onClick={() => { setError(null); setupMut.mutate(); }}
                    disabled={setupMut.isPending}
                    className="w-full py-2.5 text-sm font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-all flex items-center justify-center gap-2"
                  >
                    {setupMut.isPending
                      ? <><Loader2 size={14} className="animate-spin" /> Generando QR...</>
                      : <><ShieldCheck size={14} /> Configurar 2FA</>}
                  </button>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs">
                  <AlertCircle size={12} className="shrink-0" />
                  {error}
                </div>
              )}
            </div>
          ) : innerStep === 'qr' ? (
            // ── Mostrar QR ────────────────────────────────────────────────────
            <div className="space-y-5">
              <div>
                <p className="text-sm font-bold text-zinc-200 mb-1">Escanea este código QR</p>
                <p className="text-xs text-zinc-500">Abre tu app de autenticación y escanea la imagen</p>
              </div>

              <div className="flex justify-center">
                <div className="p-3 bg-zinc-950 border border-zinc-700 rounded-xl">
                  {setupMut.data?.qrCodeDataUrl && (
                    <img
                      src={setupMut.data.qrCodeDataUrl}
                      alt="QR Code 2FA"
                      width={180}
                      height={180}
                      className="rounded-lg"
                    />
                  )}
                </div>
              </div>

              {/* Clave manual (fallback) */}
              <div>
                <p className="text-[10px] text-zinc-600 mb-1.5 text-center">¿No puedes escanear? Ingresa la clave manual:</p>
                <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2">
                  <code className="flex-1 text-[11px] text-zinc-400 font-mono tracking-widest break-all">
                    {setupMut.data?.secret}
                  </code>
                  <button
                    onClick={copySecret}
                    className="shrink-0 text-zinc-500 hover:text-zinc-300 transition-colors"
                    title="Copiar clave"
                  >
                    {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              <button
                onClick={() => { setInnerStep('confirm'); setCode(''); setError(null); }}
                className="w-full py-2.5 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all"
              >
                Ya lo escaneé → Ingresar código
              </button>
            </div>
          ) : innerStep === 'confirm' ? (
            // ── Confirmar activación ──────────────────────────────────────────
            <div className="space-y-5">
              <div>
                <p className="text-sm font-bold text-zinc-200 mb-1">Confirma el código</p>
                <p className="text-xs text-zinc-500">
                  Ingresa el código de 6 dígitos que muestra tu app para activar el 2FA
                </p>
              </div>

              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoFocus
                value={code}
                onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(null); }}
                placeholder="000 000"
                className="w-full text-center text-2xl font-mono tracking-[0.35em] px-4 py-4
                           bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100
                           placeholder:text-zinc-700 outline-none focus:border-blue-500/60
                           focus:ring-1 focus:ring-blue-500/20 transition-all"
              />

              {error && (
                <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs">
                  <AlertCircle size={12} className="shrink-0" /> {error}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => { setInnerStep('qr'); setCode(''); setError(null); }}
                  className="flex-1 py-2.5 text-sm font-semibold text-zinc-400 border border-zinc-700 hover:border-zinc-600 rounded-lg transition-all"
                >
                  ← Volver al QR
                </button>
                <button
                  onClick={handleEnable}
                  disabled={enableMut.isPending || code.length !== 6}
                  className="flex-1 py-2.5 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg transition-all flex items-center justify-center gap-1.5"
                >
                  {enableMut.isPending
                    ? <Loader2 size={14} className="animate-spin" />
                    : <ShieldCheck size={14} />}
                  Activar 2FA
                </button>
              </div>
            </div>
          ) : (
            // ── Confirmar desactivación ───────────────────────────────────────
            <div className="space-y-5">
              <div>
                <p className="text-sm font-bold text-zinc-200 mb-1">Confirma para desactivar</p>
                <p className="text-xs text-zinc-500">
                  Ingresa el código de tu app de autenticación para confirmar que eres tú
                </p>
              </div>

              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoFocus
                value={code}
                onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(null); }}
                placeholder="000 000"
                className="w-full text-center text-2xl font-mono tracking-[0.35em] px-4 py-4
                           bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100
                           placeholder:text-zinc-700 outline-none focus:border-blue-500/60
                           focus:ring-1 focus:ring-blue-500/20 transition-all"
              />

              {error && (
                <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs">
                  <AlertCircle size={12} className="shrink-0" /> {error}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => { setInnerStep('idle'); setCode(''); setError(null); }}
                  className="flex-1 py-2.5 text-sm font-semibold text-zinc-400 border border-zinc-700 hover:border-zinc-600 rounded-lg transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDisable}
                  disabled={disableMut.isPending || code.length !== 6}
                  className="flex-1 py-2.5 text-sm font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white rounded-lg transition-all flex items-center justify-center gap-1.5"
                >
                  {disableMut.isPending
                    ? <Loader2 size={14} className="animate-spin" />
                    : <ShieldOff size={14} />}
                  Desactivar
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
