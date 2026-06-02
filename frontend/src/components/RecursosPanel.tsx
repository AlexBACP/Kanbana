/**
 * RecursosPanel
 *
 * Panel de recursos externos de un proyecto (Drive, GitHub, Figma, etc.).
 * Se muestra en la tab "Recursos" de ProyectoDetalle en FichasPanel.
 *
 * Flujo:
 *   - Lista los recursos como tarjetas con acceso directo
 *   - Los recursos de tipo GitHub muestran el GitHubWidget expandible debajo
 *   - Formulario inline para agregar un nuevo recurso (auto-detecta el tipo desde la URL)
 *   - Solo canManage puede agregar / eliminar recursos
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Github, HardDrive, Figma, BookOpen, LayoutGrid, Ticket,
  Link2, Plus, Trash2, ExternalLink, Loader2, AlertCircle,
  ChevronDown, Box, Globe,
} from 'lucide-react';
import { recursoService } from '../services/recurso.service';
import { GitHubWidget } from './GitHubWidget';

// ─── Tipo config ──────────────────────────────────────────────────────────────

type TipoRecurso = 'github' | 'drive' | 'figma' | 'notion' | 'trello' | 'jira' | 'link';

const TIPO_CONFIG: Record<TipoRecurso, {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  color: string;
  bg: string;
  border: string;
  label: string;
}> = {
  github: { icon: Github,     color: 'text-white',     bg: 'bg-zinc-800',       border: 'border-zinc-600',       label: 'GitHub' },
  drive:  { icon: HardDrive,  color: 'text-blue-400',  bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    label: 'Google Drive' },
  figma:  { icon: Figma,      color: 'text-pink-400',  bg: 'bg-pink-500/10',    border: 'border-pink-500/20',    label: 'Figma' },
  notion: { icon: BookOpen,   color: 'text-zinc-300',  bg: 'bg-zinc-700/40',    border: 'border-zinc-600/40',    label: 'Notion' },
  trello: { icon: LayoutGrid, color: 'text-blue-400',  bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    label: 'Trello' },
  jira:   { icon: Ticket,     color: 'text-indigo-400',bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20',  label: 'Jira' },
  link:   { icon: Link2,      color: 'text-zinc-400',  bg: 'bg-zinc-700/30',    border: 'border-zinc-600/30',    label: 'Enlace' },
};

function detectTipoFromUrl(url: string): TipoRecurso {
  if (/github\.com/i.test(url))            return 'github';
  if (/drive\.google\.com/i.test(url))     return 'drive';
  if (/figma\.com/i.test(url))             return 'figma';
  if (/notion\.so/i.test(url))             return 'notion';
  if (/trello\.com/i.test(url))            return 'trello';
  if (/atlassian\.net|jira\./i.test(url))  return 'jira';
  return 'link';
}

// ─── AddRecursoForm ───────────────────────────────────────────────────────────

const AddRecursoForm = ({
  proyectoId,
  onSuccess,
  onCancel,
}: {
  proyectoId: number;
  onSuccess: () => void;
  onCancel: () => void;
}) => {
  const [nombre,      setNombre]      = useState('');
  const [url,         setUrl]         = useState('');
  const [descripcion, setDescripcion] = useState('');
  const qc = useQueryClient();

  const detectedTipo = url.trim() ? detectTipoFromUrl(url.trim()) : null;
  const tipoConfig   = detectedTipo ? TIPO_CONFIG[detectedTipo] : null;
  const TipoIcon     = tipoConfig?.icon ?? Globe;

  const mutation = useMutation({
    mutationFn: () => recursoService.create(proyectoId, {
      nombre:      nombre.trim(),
      url:         url.trim(),
      descripcion: descripcion.trim() || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recursos', proyectoId] });
      onSuccess();
    },
  });

  const INP = 'w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-[12px] text-zinc-200 outline-none focus:border-blue-500/50 placeholder:text-zinc-600 transition-colors';

  return (
    <div className="bg-zinc-800/50 border border-zinc-700/60 rounded-2xl p-5 mb-4">
      <h4 className="text-[11px] font-black text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
        <Plus size={12} /> Nuevo recurso
      </h4>

      <div className="space-y-3">
        {/* URL — primer campo para auto-detección visual */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
            URL del recurso *
          </label>
          <div className="relative">
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://github.com/org/repositorio"
              className={INP + ' pr-20'}
              required
            />
            {tipoConfig && (
              <div className={`absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-0.5 rounded-md ${tipoConfig.bg} ${tipoConfig.border} border`}>
                <TipoIcon size={10} className={tipoConfig.color} />
                <span className={`text-[9px] font-black uppercase tracking-widest ${tipoConfig.color}`}>
                  {tipoConfig.label}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Nombre */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
            Nombre *
          </label>
          <input
            type="text"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="ej: Repositorio Backend, Drive T1"
            className={INP}
            required
          />
        </div>

        {/* Descripción */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
            Descripción <span className="text-zinc-600 normal-case tracking-normal">(opcional)</span>
          </label>
          <input
            type="text"
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            placeholder="ej: Código fuente del módulo de autenticación"
            className={INP}
          />
        </div>

        {/* Error */}
        {mutation.isError && (
          <div className="flex items-center gap-2 p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg">
            <AlertCircle size={12} className="text-rose-400 shrink-0" />
            <p className="text-[11px] text-rose-300">
              {(mutation.error as any)?.response?.data?.message || 'Error al crear el recurso'}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => mutation.mutate()}
            disabled={!nombre.trim() || !url.trim() || mutation.isPending}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-[12px] font-black rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {mutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            {mutation.isPending ? 'Guardando…' : 'Agregar recurso'}
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2.5 border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-200 text-[12px] font-bold rounded-xl transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── RecursoCard ──────────────────────────────────────────────────────────────

const RecursoCard = ({
  recurso,
  proyectoId,
  canManage,
  onDelete,
}: {
  recurso: any;
  proyectoId: number;
  canManage: boolean;
  onDelete: (id: number) => void;
}) => {
  const tipo = (recurso.tipo as TipoRecurso) || 'link';
  const cfg  = TIPO_CONFIG[tipo] || TIPO_CONFIG.link;
  const Icon = cfg.icon;
  const isGitHub = tipo === 'github';

  return (
    <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-2xl p-4 hover:border-zinc-600/60 transition-all group">
      {/* Card body */}
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`w-10 h-10 rounded-xl ${cfg.bg} border ${cfg.border} flex items-center justify-center shrink-0 mt-0.5`}>
          <Icon size={18} className={cfg.color} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[13px] font-black text-zinc-200 truncate">{recurso.nombre}</p>
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-widest ${cfg.bg} ${cfg.border} ${cfg.color}`}>
              {cfg.label}
            </span>
          </div>
          {recurso.descripcion && (
            <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-2">{recurso.descripcion}</p>
          )}
          <p className="text-[10px] text-zinc-600 mt-1 truncate">{recurso.url}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* External link */}
          <a
            href={recurso.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700/50 hover:bg-zinc-700 border border-zinc-600/50 hover:border-zinc-500 text-zinc-300 hover:text-white rounded-lg text-[11px] font-black transition-all"
          >
            <ExternalLink size={11} /> Abrir
          </a>

          {/* Delete */}
          {canManage && (
            <button
              onClick={() => onDelete(recurso.id)}
              className="p-1.5 rounded-lg text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
              title="Eliminar recurso"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* GitHub widget — inline expandible */}
      {isGitHub && (
        <GitHubWidget
          recursoId={recurso.id}
          proyectoId={proyectoId}
          canManage={canManage}
        />
      )}
    </div>
  );
};

// ─── RecursosPanel ─────────────────────────────────────────────────────────────

interface RecursosPanelProps {
  proyectoId: number;
  canManage: boolean;
}

export const RecursosPanel = ({ proyectoId, canManage }: RecursosPanelProps) => {
  const [showForm, setShowForm] = useState(false);
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ['recursos', proyectoId],
    queryFn:  () => recursoService.getAll(proyectoId),
    staleTime: 60_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => recursoService.remove(proyectoId, id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['recursos', proyectoId] }),
  });

  const recursos = data as any[];

  // Agrupamos: github primero, luego por orden
  const sorted = [...recursos].sort((a, b) => {
    if (a.tipo === 'github' && b.tipo !== 'github') return -1;
    if (a.tipo !== 'github' && b.tipo === 'github') return 1;
    return a.orden - b.orden;
  });

  const handleDelete = (id: number) => {
    if (window.confirm('¿Eliminar este recurso?')) deleteMutation.mutate(id);
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-[13px] font-black text-zinc-200">Recursos del proyecto</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Accesos directos a herramientas externas — Drive, GitHub, Figma, y más.
            </p>
          </div>
          {canManage && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[12px] font-black rounded-xl transition-colors"
            >
              <Plus size={13} /> Agregar
            </button>
          )}
        </div>

        {/* ── Add form ────────────────────────────────────────────────────── */}
        {showForm && (
          <AddRecursoForm
            proyectoId={proyectoId}
            onSuccess={() => setShowForm(false)}
            onCancel={() => setShowForm(false)}
          />
        )}

        {/* ── Loading ─────────────────────────────────────────────────────── */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2].map(n => (
              <div key={n} className="h-20 bg-zinc-800/30 rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

        {/* ── Resource cards ─────────────────────────────────────────────── */}
        {!isLoading && sorted.length > 0 && (
          <div className="space-y-3">
            {sorted.map((r: any) => (
              <RecursoCard
                key={r.id}
                recurso={r}
                proyectoId={proyectoId}
                canManage={canManage}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {/* ── Empty state ─────────────────────────────────────────────────── */}
        {!isLoading && sorted.length === 0 && !showForm && (
          <div className="flex flex-col items-center justify-center text-center py-16">
            <div className="w-16 h-16 bg-zinc-800/60 border border-zinc-700/50 rounded-2xl flex items-center justify-center mb-5">
              <Box size={28} className="text-zinc-600" />
            </div>
            <h3 className="text-[14px] font-black text-zinc-400 mb-2">Sin recursos todavía</h3>
            <p className="text-[12px] text-zinc-600 leading-relaxed max-w-xs mb-6">
              Agrega accesos directos a GitHub, Drive, Figma u otras herramientas del proyecto.
            </p>
            {canManage && (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-[12px] font-black rounded-xl transition-colors"
              >
                <Plus size={13} /> Agregar primer recurso
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
