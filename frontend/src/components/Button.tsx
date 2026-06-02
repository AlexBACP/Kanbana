import { ReactNode } from 'react';

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
}

const variants = {
  primary: 'bg-primary-600 hover:bg-primary-700 text-white shadow-xl shadow-primary-500/20 active:scale-95 border border-primary-500/30',
  secondary: 'bg-zinc-950 border border-zinc-800 text-zinc-100 hover:bg-zinc-800 hover:border-zinc-700 active:scale-95',
  danger: 'bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white active:scale-95 shadow-lg shadow-rose-500/5',
  ghost: 'bg-transparent text-zinc-500 hover:text-zinc-100 hover:bg-zinc-900 transition-all',
};

const sizes = {
  sm: 'px-4 py-2 text-[10px] rounded-xl font-black uppercase tracking-widest',
  md: 'px-6 py-3.5 text-xs rounded-2xl font-black uppercase tracking-widest',
  lg: 'px-8 py-4.5 text-sm rounded-3xl font-black uppercase tracking-widest',
};

export const Button = ({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  disabled = false,
  isLoading = false,
  className = '',
}: ButtonProps) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`
        inline-flex items-center justify-center gap-2 font-medium rounded-lg
        transition-colors duration-150 focus:outline-none focus:ring-2
        focus:ring-primary-600 focus:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]} ${sizes[size]} ${className}
      `}
    >
      {isLoading && (
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
      )}
      {children}
    </button>
  );
};