import { userService } from '../services/user.service';

interface AvatarProps {
  nombre: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** URL cruda del avatar (user.avatar_url). Si existe, se muestra la foto. */
  avatarUrl?: string | null;
}

const sizes = {
  xs: 'h-5 w-5 text-[9px]',
  sm: 'h-7 w-7 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-11 w-11 text-base',
};

/**
 * Avatar — muestra la FOTO de perfil del usuario si tiene una,
 * y si no, cae a las iniciales del nombre. Componente canónico:
 * úsalo en cualquier lugar donde se represente un usuario.
 */
export const Avatar = ({ nombre, size = 'md', avatarUrl }: AvatarProps) => {
  const initials = (nombre || '')
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase() || 'KA';

  const src = userService.getAvatarUrl(avatarUrl);

  return (
    <div className={`${sizes[size]} rounded-full bg-primary-600 text-white flex items-center justify-center font-semibold overflow-hidden shrink-0`}>
      {src
        ? <img src={src} alt={nombre} className="w-full h-full object-cover" />
        : initials}
    </div>
  );
};
