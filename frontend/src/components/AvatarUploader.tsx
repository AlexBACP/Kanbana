/**
 * AvatarUploader — componente reutilizable para subir foto de perfil.
 * Muestra preview inmediato y sube al servidor via multipart/form-data.
 * Al completarse, llama onSuccess con la URL devuelta por el backend.
 */
import { useRef, useState, ChangeEvent } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { userService } from '../services/user.service';

interface AvatarUploaderProps {
  userId: number;
  currentUrl?: string | null;
  nombre?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  onSuccess?: (avatarUrl: string) => void;
  editable?: boolean;
}

const SIZE = {
  sm:  { outer: 'w-12 h-12', text: 'text-sm',  icon: 14 },
  md:  { outer: 'w-20 h-20', text: 'text-xl',  icon: 16 },
  lg:  { outer: 'w-28 h-28', text: 'text-3xl', icon: 20 },
  xl:   { outer: 'w-32 h-32', text: 'text-4xl', icon: 20 },   // nuevo tamaño
  '2xl': { outer: 'w-44 h-44', text: 'text-5xl', icon: 28 }, // aún más grande
  '3xl': { outer: 'w-56 h-56', text: 'text-6xl', icon: 32 },
};

export const AvatarUploader = ({
  userId,
  currentUrl,
  nombre,
  size = 'md',
  onSuccess,
  editable = true,
}: AvatarUploaderProps) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(
    userService.getAvatarUrl(currentUrl)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { outer, text, icon } = SIZE[size];

  const initials = nombre?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'KA';

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tamaño en el cliente también (3MB)
    if (file.size > 3 * 1024 * 1024) {
      setError('La imagen no puede superar 3MB');
      return;
    }

    // Preview inmediato
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setError(null);
    setLoading(true);

    try {
      const { avatar_url } = await userService.uploadAvatar(userId, file);
      const publicUrl = userService.getAvatarUrl(avatar_url) || avatar_url;
      setPreview(publicUrl);
      onSuccess?.(avatar_url);
    } catch (err: any) {
      setError('No se pudo subir la imagen');
      // Revertir preview si falla
      setPreview(userService.getAvatarUrl(currentUrl));
    } finally {
      setLoading(false);
      // Reset input para poder re-subir el mismo archivo
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`relative ${outer} group`}>
        {/* Avatar */}
        <div className={`${outer} rounded-full bg-gradient-to-br from-primary-600 to-indigo-700 flex items-center justify-center overflow-hidden border-2 border-dark-border shadow-xl`}>
          {preview ? (
            <img src={preview} alt={nombre} className="w-full h-full object-cover" />
          ) : (
            <span className={`${text} font-black text-white`}>{initials}</span>
          )}
          {loading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
              <Loader2 size={icon} className="text-white animate-spin" />
            </div>
          )}
        </div>

        {/* Botón de cámara */}
        {editable && !loading && (
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute bottom-0 right-0 w-7 h-7 bg-primary-600 hover:bg-primary-500 rounded-full flex items-center justify-center border-2 border-dark-bg shadow-lg transition-all opacity-0 group-hover:opacity-100"
            title="Cambiar foto"
          >
            <Camera size={17} className="text-white" />
          </button>
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
