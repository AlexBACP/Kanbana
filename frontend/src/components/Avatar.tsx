interface AvatarProps {
  nombre: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-11 w-11 text-base',
};

export const Avatar = ({ nombre, size = 'md' }: AvatarProps) => {
  const initials = nombre
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <div className={`${sizes[size]} rounded-full bg-primary-600 text-white flex items-center justify-center font-semibold`}>
      {initials}
    </div>
  );
};