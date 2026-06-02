/**
 * ProjectResourcesCard — Botones de los recursos del proyecto.
 *
 * Se muestra en el detalle de una tarea (debajo de "Detalles") para que el
 * aprendiz tenga a mano los accesos del proyecto (GitHub, Drive, Figma, etc.)
 * sin tener que volver al tablero. Solo lectura: abre cada recurso en una pestaña.
 */
import { useQuery } from '@tanstack/react-query';
import {
  Github, HardDrive, Figma, BookOpen, LayoutGrid,
  Ticket, Link2, ExternalLink, FolderOpen,
} from 'lucide-react';
import { recursoService } from '../services/recurso.service';

type TipoRecurso = 'github' | 'drive' | 'figma' | 'notion' | 'trello' | 'jira' | 'link';

const TIPO_CONFIG: Record<TipoRecurso, {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  color: string; bg: string; border: string;
}> = {
  github: { icon: Github,     color: 'text-zinc-200',   bg: 'bg-zinc-800',      border: 'border-zinc-600' },
  drive:  { icon: HardDrive,  color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20' },
  figma:  { icon: Figma,      color: 'text-pink-400',   bg: 'bg-pink-500/10',   border: 'border-pink-500/20' },
  notion: { icon: BookOpen,   color: 'text-zinc-300',   bg: 'bg-zinc-700/40',   border: 'border-zinc-600/40' },
  trello: { icon: LayoutGrid, color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20' },
  jira:   { icon: Ticket,     color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
  link:   { icon: Link2,      color: 'text-zinc-400',   bg: 'bg-zinc-700/30',   border: 'border-zinc-600/30' },
};

interface Props {
  proyectoId: number;
}

export const ProjectResourcesCard = ({ proyectoId }: Props) => {
  const { data: recursos = [], isLoading } = useQuery({
    queryKey: ['recursos', proyectoId],
    queryFn:  () => recursoService.getAll(proyectoId),
    enabled:  !!proyectoId,
    staleTime: 60_000,
  });

  // No renderizamos nada si no hay recursos (mantiene la barra lateral limpia)
  if (isLoading || (recursos as any[]).length === 0) return null;

  // GitHub primero, luego por orden
  const sorted = [...(recursos as any[])].sort((a, b) => {
    if (a.tipo === 'github' && b.tipo !== 'github') return -1;
    if (a.tipo !== 'github' && b.tipo === 'github') return 1;
    return (a.orden ?? 99) - (b.orden ?? 99);
  });

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden p-5 space-y-3">
      <h3 className="text-[11px] font-black text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-3 flex items-center gap-2">
        <FolderOpen size={13} className="text-zinc-600" />
        Recursos del proyecto
      </h3>

      <div className="space-y-2">
        {sorted.map((r: any) => {
          const tipo = (r.tipo as TipoRecurso) || 'link';
          const cfg  = TIPO_CONFIG[tipo] || TIPO_CONFIG.link;
          const Icon = cfg.icon;
          return (
            <a
              key={r.id}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              title={r.descripcion || r.url}
              className="flex items-center gap-3 p-2.5 rounded-lg bg-zinc-800/40 border border-zinc-700/50 hover:border-zinc-600 hover:bg-zinc-800 transition-all group"
            >
              <div className={`w-8 h-8 rounded-lg ${cfg.bg} border ${cfg.border} flex items-center justify-center shrink-0`}>
                <Icon size={15} className={cfg.color} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-zinc-200 truncate group-hover:text-blue-300 transition-colors">
                  {r.nombre}
                </p>
                {r.descripcion && (
                  <p className="text-[10px] text-zinc-500 truncate">{r.descripcion}</p>
                )}
              </div>
              <ExternalLink size={13} className="text-zinc-600 group-hover:text-blue-400 shrink-0 transition-colors" />
            </a>
          );
        })}
      </div>
    </div>
  );
};
