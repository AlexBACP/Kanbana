/**
 * SugerenciasCompactas — panel lateral de sugerencias en el BacklogPage.
 *
 * Diferencias respecto a SugerenciasModulosPanel:
 *  - Filtra SOLO las sugerencias del trimestre activo (trimestreId)
 *  - Clic en una sugerencia → rellena el formulario (onPreFill) sin crear nada
 *  - Diseño compacto para columna derecha
 *  - Mantiene Generar / Regenerar / Descartar
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles, X, RefreshCw, Lightbulb, Cpu, BookMarked,
  Loader2, CheckCircle2, ArrowLeft,
} from 'lucide-react';
import { projectService } from '../services/project.service';

const CATEGORIA_COLOR: Record<string, string> = {
  'Documentación': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Diseño':        'bg-pink-500/10 text-pink-400 border-pink-500/20',
  'Backend':       'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Frontend':      'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  'Seguridad':     'bg-rose-500/10 text-rose-400 border-rose-500/20',
  'Calidad':       'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'UX':            'bg-violet-500/10 text-violet-400 border-violet-500/20',
  'DevOps':        'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'Datos':         'bg-teal-500/10 text-teal-400 border-teal-500/20',
  'Gestión':       'bg-zinc-500/10 text-zinc-300 border-zinc-500/20',
};
const catColor = (c?: string) => CATEGORIA_COLOR[c ?? ''] ?? 'bg-zinc-700/30 text-zinc-300 border-zinc-600/30';

export interface PreFillData {
  nombre: string;
  descripcion?: string;
}

interface Props {
  proyectoId: number;
  trimestreId: number | null;
  canManage: boolean;
  /** Callback: el usuario hizo clic en una sugerencia → rellenar el form */
  onPreFill: (data: PreFillData) => void;
}

export const SugerenciasCompactas = ({ proyectoId, trimestreId, canManage, onPreFill }: Props) => {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['sugerencias', proyectoId],
    queryFn:  () => projectService.getSugerencias(proyectoId),
    enabled:  !!proyectoId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['sugerencias', proyectoId] });
    qc.invalidateQueries({ queryKey: ['trimestres', proyectoId] });
  };

  const generarMut   = useMutation({ mutationFn: () => projectService.generarSugerencias(proyectoId),   onSuccess: invalidate });
  const regenerarMut = useMutation({ mutationFn: () => projectService.regenerarSugerencias(proyectoId), onSuccess: invalidate });
  const descartarMut = useMutation({ mutationFn: (id: number) => projectService.descartarSugerencia(id), onSuccess: invalidate });

  // Filtrar solo las sugerencias del trimestre activo
  const allTrimestres: any[] = data?.trimestres ?? [];
  const trimData = trimestreId
    ? allTrimestres.find((t: any) => t.id === trimestreId)
    : allTrimestres[0];

  const sugerencias: any[] = (trimData?.sugerencias ?? []).filter((s: any) => s.estado !== 'descartada');
  const hayAlgo      = sugerencias.length > 0;
  const trabajando   = generarMut.isPending || regenerarMut.isPending;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Cabecera */}
      <div className="shrink-0 px-5 pt-4 pb-3 border-b border-zinc-800/60">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles size={13} className="text-violet-400 shrink-0" />
            <h3 className="text-[11px] font-black text-zinc-300 uppercase tracking-[0.18em]">
              Sugerencias
            </h3>
            {sugerencias.filter(s => s.estado === 'pendiente').length > 0 && (
              <span className="text-[9px] font-black text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded-full border border-violet-500/20">
                {sugerencias.filter(s => s.estado === 'pendiente').length}
              </span>
            )}
          </div>
          {canManage && (
            <div className="flex items-center gap-1.5">
              {hayAlgo ? (
                <button
                  onClick={() => window.confirm('¿Regenerar sugerencias?') && regenerarMut.mutate()}
                  disabled={trabajando}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-md border text-zinc-500 border-zinc-700 hover:text-zinc-300 hover:border-zinc-600 transition-all disabled:opacity-40"
                >
                  <RefreshCw size={10} className={regenerarMut.isPending ? 'animate-spin' : ''} />
                  Regenerar
                </button>
              ) : (
                <button
                  onClick={() => generarMut.mutate()}
                  disabled={trabajando}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-black rounded-md border text-violet-400 border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 transition-all disabled:opacity-40"
                >
                  {generarMut.isPending ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                  Generar
                </button>
              )}
            </div>
          )}
        </div>

        {/* Estado IA */}
        <p className="text-[10px] text-zinc-600 flex items-center gap-1.5 mt-1.5">
          {data?.ia_disponible
            ? <><Cpu size={10} className="text-emerald-400/70" /> IA (Gemini)</>
            : <><BookMarked size={10} className="text-amber-400/70" /> Catálogo SDLC</>}
          {trimData && (
            <span className="ml-auto text-zinc-700 font-bold">
              {trimData.nombre ?? `T${trimData.numero}`}
            </span>
          )}
        </p>

        {/* Hint de cómo usar */}
        {hayAlgo && (
          <div className="flex items-center gap-1.5 mt-2 px-2 py-1.5 bg-blue-500/6 border border-blue-500/15 rounded-md">
            <ArrowLeft size={10} className="text-blue-400/70 shrink-0" />
            <p className="text-[10px] text-blue-400/80 font-bold">
              Clic en una sugerencia para rellenar el formulario
            </p>
          </div>
        )}
      </div>

      {/* Lista de sugerencias */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {isLoading || trabajando ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Loader2 size={20} className="animate-spin text-violet-400" />
            <p className="text-[11px] text-zinc-500">
              {trabajando ? 'Analizando el proyecto…' : 'Cargando…'}
            </p>
          </div>
        ) : !hayAlgo ? (
          <div className="py-10 text-center">
            <Lightbulb size={22} className="mx-auto mb-2 text-zinc-700" />
            <p className="text-[12px] text-zinc-500 font-bold">Sin sugerencias</p>
            <p className="text-[10px] text-zinc-600 mt-1 leading-relaxed max-w-[200px] mx-auto">
              {canManage
                ? 'Pulsa "Generar" para que la IA analice el proyecto.'
                : 'El instructor puede generar sugerencias.'}
            </p>
          </div>
        ) : (
          sugerencias.map((s: any) => {
            const creada = s.estado === 'creada';
            return (
              <div
                key={s.id}
                onClick={() => {
                  if (!creada) onPreFill({ nombre: s.nombre, descripcion: s.descripcion });
                }}
                className={`p-3 rounded-md border transition-all ${
                  creada
                    ? 'bg-emerald-500/5 border-emerald-500/20 cursor-default'
                    : 'bg-zinc-900 border-zinc-800 hover:border-violet-500/40 hover:bg-violet-500/5 cursor-pointer group'
                }`}
              >
                {/* Nombre + badge categoría */}
                <div className="flex items-start gap-2 mb-1">
                  <p className={`text-[12px] font-bold leading-snug flex-1 min-w-0 ${creada ? 'text-zinc-500' : 'text-zinc-200 group-hover:text-white'}`}>
                    {s.nombre}
                  </p>
                  <span className={`shrink-0 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${catColor(s.categoria)}`}>
                    {s.categoria}
                  </span>
                </div>

                {/* Descripción */}
                {s.descripcion && (
                  <p className="text-[10px] text-zinc-500 leading-relaxed line-clamp-2">{s.descripcion}</p>
                )}

                {/* Justificación IA */}
                {s.justificacion && !creada && (
                  <p className="text-[10px] text-zinc-600 mt-1 flex items-start gap-1 italic">
                    <Lightbulb size={9} className="text-violet-400/70 shrink-0 mt-0.5" />
                    {s.justificacion}
                  </p>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between gap-2 mt-2 pt-1.5 border-t border-zinc-800/60">
                  <span className="text-[9px] text-zinc-700 font-bold">
                    {s.semanas} sem · {s.fuente === 'ia' ? 'IA' : 'catálogo'}
                  </span>
                  {creada ? (
                    <span className="flex items-center gap-1 text-[9px] font-black text-emerald-400 uppercase tracking-widest">
                      <CheckCircle2 size={9} /> Módulo creado
                    </span>
                  ) : canManage ? (
                    <button
                      onClick={e => { e.stopPropagation(); descartarMut.mutate(s.id); }}
                      className="p-0.5 rounded text-zinc-700 hover:text-rose-400 transition-colors"
                      title="Descartar sugerencia"
                    >
                      <X size={12} />
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
