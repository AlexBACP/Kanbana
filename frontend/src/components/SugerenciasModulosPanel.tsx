/**
 * SugerenciasModulosPanel — sugerencias inteligentes de módulos por trimestre.
 *
 * El sistema analiza el contexto del proyecto (competencia, RA, descripción,
 * tipo de formación y la etapa SDLC de cada trimestre) con IA (Gemini) y, si no
 * está disponible, con el catálogo SDLC. Cada sugerencia se convierte en un
 * módulo editable con un clic.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles, Plus, X, RefreshCw, Lightbulb, Cpu, BookMarked, Loader2, CheckCircle2,
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

export const SugerenciasModulosPanel = ({
  proyectoId,
  canManage,
}: {
  proyectoId: number;
  canManage: boolean;
}) => {
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

  const generarMut = useMutation({
    mutationFn: () => projectService.generarSugerencias(proyectoId),
    onSuccess: invalidate,
    onError: (e: any) => alert(e?.response?.data?.message ?? 'No se pudieron generar las sugerencias'),
  });

  const regenerarMut = useMutation({
    mutationFn: () => projectService.regenerarSugerencias(proyectoId),
    onSuccess: invalidate,
    onError: (e: any) => alert(e?.response?.data?.message ?? 'No se pudieron regenerar las sugerencias'),
  });

  const crearMut = useMutation({
    mutationFn: (sugId: number) => projectService.crearModuloSugerencia(sugId),
    onSuccess: invalidate,
    onError: (e: any) => alert(e?.response?.data?.message ?? 'No se pudo crear el módulo'),
  });

  const descartarMut = useMutation({
    mutationFn: (sugId: number) => projectService.descartarSugerencia(sugId),
    onSuccess: invalidate,
  });

  const trimestres = data?.trimestres ?? [];
  const totalSugeridas = data?.total ?? 0;
  const hayAlgo = trimestres.some((t: any) => (t.sugerencias?.length ?? 0) > 0);
  const trabajando = generarMut.isPending || regenerarMut.isPending;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
      {/* Cabecera */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-violet-400" />
          <h3 className="text-sm font-black text-zinc-200 uppercase tracking-widest">Sugerencias inteligentes</h3>
          {totalSugeridas > 0 && (
            <span className="text-[10px] font-black text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-500/20">{totalSugeridas}</span>
          )}
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            {hayAlgo && (
              <button
                onClick={() => window.confirm('¿Regenerar sugerencias? Se descartan las pendientes y se analiza de nuevo.') && regenerarMut.mutate()}
                disabled={trabajando}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg border text-zinc-400 border-zinc-700 hover:text-zinc-200 hover:border-zinc-500 transition-all disabled:opacity-40"
              >
                <RefreshCw size={12} className={regenerarMut.isPending ? 'animate-spin' : ''} /> Regenerar
              </button>
            )}
            {!hayAlgo && (
              <button
                onClick={() => generarMut.mutate()}
                disabled={trabajando}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black rounded-lg border text-violet-300 border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 transition-all disabled:opacity-40"
              >
                {generarMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                {generarMut.isPending ? 'Analizando...' : 'Generar sugerencias'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Estado IA */}
      <p className="text-xs text-zinc-500 flex items-center gap-1.5">
        {data?.ia_disponible
          ? <><Cpu size={12} className="text-emerald-400" /> Análisis con IA (Gemini) activo</>
          : <><BookMarked size={12} className="text-amber-400" /> IA no configurada — se usa el catálogo SDLC</>}
      </p>

      {/* Contenido */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-zinc-600"><Loader2 size={20} className="animate-spin" /></div>
      ) : trabajando && !hayAlgo ? (
        <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
          <Loader2 size={26} className="animate-spin text-violet-400" />
          <p className="text-sm text-zinc-400">Analizando el proyecto y proponiendo módulos…</p>
        </div>
      ) : !hayAlgo ? (
        <div className="py-8 text-center">
          <Lightbulb size={28} className="mx-auto mb-3 text-zinc-700" />
          <p className="text-sm text-zinc-400 font-bold">Aún no hay sugerencias</p>
          <p className="text-xs text-zinc-600 mt-1 max-w-md mx-auto">
            {canManage
              ? 'Pulsa "Generar sugerencias" para que el sistema analice el proyecto y proponga módulos extra para cada trimestre.'
              : 'El instructor o líder técnico puede generar sugerencias de módulos.'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {trimestres.filter((t: any) => (t.sugerencias?.length ?? 0) > 0).map((t: any) => (
            <div key={t.id} className="space-y-2">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                T{t.numero} · {t.nombre}
              </p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {t.sugerencias.map((s: any) => {
                  const creada = s.estado === 'creada';
                  return (
                    <div key={s.id} className={`p-3 rounded-lg border ${creada ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-zinc-800/50 border-zinc-700/50'}`}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm font-bold text-zinc-200 flex-1 min-w-0">{s.nombre}</p>
                        <span className={`shrink-0 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${catColor(s.categoria)}`}>
                          {s.categoria}
                        </span>
                      </div>
                      {s.descripcion && <p className="text-xs text-zinc-400 leading-relaxed">{s.descripcion}</p>}
                      {s.justificacion && (
                        <p className="text-[11px] text-zinc-500 mt-1.5 flex items-start gap-1.5">
                          <Lightbulb size={11} className="text-violet-400 shrink-0 mt-0.5" />
                          <span className="italic">{s.justificacion}</span>
                        </p>
                      )}
                      <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-zinc-700/40">
                        <span className="text-[10px] text-zinc-600 font-bold">
                          {s.semanas} sem · {s.fuente === 'ia' ? 'IA' : 'catálogo'}
                        </span>
                        {creada ? (
                          <span className="flex items-center gap-1 text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                            <CheckCircle2 size={11} /> Módulo creado
                          </span>
                        ) : canManage ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => descartarMut.mutate(s.id)}
                              className="p-1 rounded text-zinc-600 hover:text-rose-400 transition-colors"
                              title="Descartar"
                            >
                              <X size={13} />
                            </button>
                            <button
                              onClick={() => crearMut.mutate(s.id)}
                              disabled={crearMut.isPending}
                              className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-black rounded-md bg-violet-600 hover:bg-violet-500 text-white transition-all disabled:opacity-40"
                            >
                              <Plus size={11} /> Crear módulo
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
