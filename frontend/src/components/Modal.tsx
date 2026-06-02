import { ReactNode } from 'react';
import { X } from 'lucide-react';
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export const Modal = ({ isOpen, onClose, title, children, size = 'md' }: ModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in">
      {/* Overlay con blur más suave */}
      <div 
        className="absolute inset-0 bg-[#1f1f21] backdrop-blur-sm transition-all duration-500" 
        onClick={onClose} 
      />
      
      {/* Contenido del Modal */}
      <div className={`
        relative bg-zinc-900 w-full ${sizes[size]}
        rounded-[3rem] shadow-2xl border border-zinc-800
        transform transition-all duration-500 overflow-hidden
      `}>
        {/* Header con gradiente sutil */}
        <div className="px-10 py-8 border-b border-zinc-800 bg-zinc-950/40 flex items-center justify-between">
          <h3 className="text-2xl font-black text-zinc-100 tracking-tight">{title}</h3>
          <button
            onClick={onClose}
            title="Cerrar"
            aria-label="Cerrar"
            className="p-3 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-2xl transition-all active:scale-90"
          >
            <X size={24} />
          </button>
        </div>
        
        {/* Cuerpo con scroll personalizado */}
        <div className="p-10 max-h-[85vh] overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};