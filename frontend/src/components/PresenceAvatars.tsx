/**
 * PresenceAvatars — Indicador de quién está viendo el tablero ahora mismo.
 *
 * Muestra hasta 4 avatares apilados. Si hay más, un chip "+N".
 * Se basa en los datos que llegan por WebSocket (presence:update).
 */
import { userService } from '../services/user.service';
import type { PresenceUser } from '../hooks/useBoardSocket';

interface Props {
  users:       PresenceUser[];
  currentUser: number | undefined;  // para excluir al propio usuario del contador
}

export const PresenceAvatars = ({ users, currentUser }: Props) => {
  // Excluir al usuario actual de la lista (él ya sabe que está ahí)
  const others = users.filter(u => u.id !== currentUser);

  if (others.length === 0) return null;

  const visible = others.slice(0, 4);
  const extra   = others.length - visible.length;

  return (
    <div className="flex items-center gap-1.5" title={`${others.length} persona(s) viendo este tablero`}>
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
      <div className="flex -space-x-2">
        {visible.map(u => {
          const avatarUrl = userService.getAvatarUrl(u.avatar_url);
          return (
            <div
              key={u.id}
              title={u.nombre}
              className="w-7 h-7 rounded-full border-2 border-zinc-900 overflow-hidden bg-zinc-700 flex items-center justify-center text-[10px] font-black text-zinc-300 shrink-0"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={u.nombre} className="w-full h-full object-cover" />
              ) : (
                u.nombre.charAt(0).toUpperCase()
              )}
            </div>
          );
        })}
        {extra > 0 && (
          <div className="w-7 h-7 rounded-full border-2 border-zinc-900 bg-zinc-700 flex items-center justify-center text-[9px] font-black text-zinc-400 shrink-0">
            +{extra}
          </div>
        )}
      </div>
    </div>
  );
};
