/**
 * AvatarUploader — sube, cambia o elimina la foto de perfil.
 * Muestra preview inmediato y sube al servidor via multipart/form-data.
 * Al completarse llama onSuccess / onDelete con el resultado.
 */
import { useRef, useState, ChangeEvent } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { userService } from '../services/user.service';

interface AvatarUploaderProps {
  userId: number;
  currentUrl?: string | null;
  nombre?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  onSuccess?: (avatarUrl: string) => void;
  onDelete?: () => void;
  editable?: boolean;
}

const SIZE = {
  sm:   { outer: 'w-12 h-12',  text: 'text-sm',  icon: 13 },
  md:   { outer: 'w-20 h-20',  text: 'text-xl',  icon: 15 },
  lg:   { outer: 'w-28 h-28',  text: 'text-3xl', icon: 18 },
  xl:   { outer: 'w-32 h-32',  text: 'text-4xl', icon: 18 },
  '2xl':{ outer: 'w-44 h-44',  text: 'text-5xl', icon: 24 },
  '3xl':{ outer: 'w-56 h-56',  text: 'text-6xl', icon: 28 },
};

export const AvatarUploader = ({
  userId,
  currentUrl,
  nombre,
  size = 'md',
  onSuccess,
  onDelete,
  editable = true,
}: AvatarUploaderProps) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(
    userService.getAvatarUrl(currentUrl)
  );
  const [loading, setLoading]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const { outer, text, icon } = SIZE[size];

  const initials = nombre?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'KA';

  // ── Subir / cambiar foto ─────────────────────────────────────────────────────
  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { setError('La imagen no puede superar 3 MB'); return; }

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setError(null);
    setLoading(true);
    try {
      const { avatar_url } = await userService.uploadAvatar(userId, file);
      setPreview(userService.getAvatarUrl(avatar_url) || avatar_url);
      onSuccess?.(avatar_url);
    } catch {
      setError('No se pudo subir la imagen');
      setPreview(userService.getAvatarUrl(currentUrl));
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // ── Eliminar foto ────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!preview || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await userService.update(userId, { avatar_url: null });
      setPreview(null);
      onDelete?.();
    } catch {
      setError('No se pudo eliminar la foto');
    } finally {
      setDeleting(false);
    }
  };

  const busy = loading || deleting;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`relative ${outer} group`}>

        {/* Círculo del avatar */}
        <div className={`${outer} rounded-full bg-gradient-to-br from-primary-600 to-indigo-700 flex items-center justify-center overflow-hidden border-2 border-zinc-800 shadow-xl`}>
          {preview
            ? <img src={preview} alt={nombre} className="w-full h-full object-cover" />
            : <span className={`${text} font-black text-white`}>{initials}</span>}
        </div>

        {/* Overlay de carga */}
        {busy && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
            <Loader2 size={icon} className="text-white animate-spin" />
          </div>
        )}

        {/* Controles (solo editable y no cargando) */}
        {editable && !busy && (
          preview ? (
            /* Tiene foto → overlay con dos botones */
            <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/55 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
              <button
                onClick={() => fileRef.current?.click()}
                className="w-7 h-7 bg-zinc-800/90 hover:bg-primary-600 rounded-full flex items-center justify-center border border-white/20 shadow transition-all"
                title="Cambiar foto"
              >
                <Camera size={13} className="text-white" />
              </button>
              <button
                onClick={handleDelete}
                className="w-7 h-7 bg-zinc-800/90 hover:bg-rose-600 rounded-full flex items-center justify-center border border-white/20 shadow transition-all"
                title="Eliminar foto"
              >
                <Trash2 size={13} className="text-white" />
              </button>
            </div>
          ) : (
            /* Sin foto → solo botón de cámara */
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-0 right-0 w-7 h-7 bg-primary-600 hover:bg-primary-500 rounded-full flex items-center justify-center border-2 border-zinc-950 shadow-lg transition-all opacity-0 group-hover:opacity-100"
              title="Añadir foto de perfil"
            >
              <Camera size={14} className="text-white" />
            </button>
          )
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleFile}
        />
      </div>

      {error && (
        <p className="text-[10px] text-rose-400 text-center max-w-[120px]">{error}</p>
      )}
    </div>
  );
};
