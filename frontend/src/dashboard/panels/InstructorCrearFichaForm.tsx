/**
 * InstructorCrearFichaForm
 * ─────────────────────────
 * Formulario unificado de creación de ficha para instructor (y coordinador).
 *
 * Funcionalidades clave:
 *  - Selector de tipo de formación: Tecnólogo (7 trimestres) o Técnico (3).
 *  - Fecha de inicio personalizable (default: hoy).
 *  - Preview en vivo de los trimestres + módulos SDLC que se generarán,
 *    con fechas reales calculadas en cliente (mismo algoritmo que el backend:
 *    12 semanas por trimestre, encadenados desde fecha_inicio).
 *  - El instructor NO necesita pedir permiso al coordinador.
 *
 * El backend (FichasService.create) genera automáticamente los trimestres
 * lectivos según el tipo seleccionado. Los módulos (sprints) se crearán
 * cuando se cree un proyecto dentro de la ficha.
 */
import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Plus, AlertTriangle, GraduationCap, Briefcase, Calendar,
  FileText, Code, ChevronDown, Sparkles, Check,
} from 'lucide-react';
import { fichaService, TipoFormacion, TrimestrePlantilla } from '../../services/ficha.service';

// ── Catálogo de tipos de formación (UI) ────────────────────────────────────
const TIPOS = [
  {
    key:       'tecnologo' as TipoFormacion,
    label:     'Tecnólogo',
    sublabel:  'Análisis y Desarrollo de Software',
    detalle:   '7 trimestres lectivos · 21 meses · 3.120 horas',
    icon:      GraduationCap,
  },
  {
    key:       'tecnico' as TipoFormacion,
    label:     'Técnico',
    sublabel:  'Programación de Software',
    detalle:   '3 trimestres lectivos · 9 meses',
    icon:      Briefcase,
  },
] as const;

// ── Helper: fecha en formato YYYY-MM-DD ────────────────────────────────────
const toIso = (d: Date) => d.toISOString().slice(0, 10);

// ── Helper: formato legible es-CO ──────────────────────────────────────────
const fmt = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

interface Props {
  userId?:        number;
  /** Si se pasa una lista, se muestra un selector de instructor (modo coordinador). */
  instructors?:   { id: number; nombre: string }[];
  onCancel:       () => void;
  onCreated:      () => void;
}

export const InstructorCrearFichaForm = ({ userId, instructors, onCancel, onCreated }: Props) => {
  const [tipo,         setTipo]         = useState<TipoFormacion>('tecnologo');
  const [fechaInicio,  setFechaInicio]  = useState<string>(toIso(new Date()));
  const [codigo,       setCodigo]       = useState('');
  const [programa,     setPrograma]     = useState('');
  const [jornada,      setJornada]      = useState<'mañana' | 'tarde' | 'noche'>('mañana');
  const [instructorId, setInstructorId] = useState<number | undefined>(userId);
  const [expandedTrim, setExpandedTrim] = useState<number | null>(0); // primer trimestre expandido por defecto

  // ── Módulos deseleccionados ("<trimIndex>:<moduloIndex>") ────────────────
  // Por defecto vacío = todos los módulos seleccionados. Se reinicia al cambiar
  // de tipo (los índices de la plantilla cambian).
  const [excluidos, setExcluidos] = useState<Set<string>>(new Set());

  const cambiarTipo = (nuevo: TipoFormacion) => {
    setTipo(nuevo);
    setExcluidos(new Set()); // nueva plantilla → todos seleccionados de nuevo
  };

  const toggleModulo = (i: number, j: number) => {
    const key = `${i}:${j}`;
    setExcluidos(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const setTrimestreTodos = (i: number, count: number, seleccionar: boolean) => {
    setExcluidos(prev => {
      const next = new Set(prev);
      for (let j = 0; j < count; j++) {
        const key = `${i}:${j}`;
        if (seleccionar) next.delete(key); else next.add(key);
      }
      return next;
    });
  };

  // ── Plantilla SDLC del tipo seleccionado ─────────────────────────────────
  // Refresca cuando cambia el tipo. Cacheada por tipo (es estática).
  const { data: plantilla = [], isLoading: loadingPlantilla } = useQuery({
    queryKey: ['fichas', 'plantilla', tipo],
    queryFn:  () => fichaService.getPlantilla(tipo),
    staleTime: Infinity,
  });

  // ── Calcular fechas reales de cada trimestre en cliente ──────────────────
  // Mismo algoritmo que el backend: 12 semanas por trimestre, encadenados.
  const trimestresConFechas = useMemo(() => {
    const inicio = new Date(fechaInicio + 'T00:00:00');
    let cursor = new Date(inicio);
    return plantilla.map((t: TrimestrePlantilla, i) => {
      const ini = new Date(cursor);
      const fin = new Date(cursor);
      fin.setDate(fin.getDate() + 12 * 7 - 1);
      cursor = new Date(fin);
      cursor.setDate(cursor.getDate() + 1);
      return {
        numero:        i + 1,
        nombre:        t.nombre,
        descripcion:   t.descripcion,
        tipo:          t.tipo,
        modulos:       t.modulos,
        fecha_inicio:  toIso(ini),
        fecha_fin:     toIso(fin),
      };
    });
  }, [plantilla, fechaInicio]);

  const fechaFinTotal = trimestresConFechas.length > 0
    ? trimestresConFechas[trimestresConFechas.length - 1].fecha_fin
    : fechaInicio;

  // ── Totales de módulos (para el resumen) ─────────────────────────────────
  const totalModulos = useMemo(
    () => trimestresConFechas.reduce((acc, t) => acc + t.modulos.length, 0),
    [trimestresConFechas],
  );
  const totalSeleccionados = useMemo(
    () => trimestresConFechas.reduce(
      (acc, t, i) => acc + t.modulos.filter((_, mi) => !excluidos.has(`${i}:${mi}`)).length,
      0,
    ),
    [trimestresConFechas, excluidos],
  );

  // ── Mutación de creación ─────────────────────────────────────────────────
  const [createError, setCreateError] = useState<string | null>(null);
  const createMut = useMutation({
    mutationFn: fichaService.create,
    onSuccess:  onCreated,
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      setCreateError(Array.isArray(msg) ? msg.join(', ') : (msg || 'No se pudo crear la ficha. Intenta de nuevo.'));
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreateError(null);
    createMut.mutate({
      codigo:         codigo.trim(),
      programa:       programa.trim(),
      tipo_formacion: tipo,
      jornada,
      fecha_inicio:   fechaInicio,
      // Si hay lista de instructores (modo coordinador), usa el seleccionado.
      // En modo instructor, el backend sobrescribe al id del actor.
      instructor_id:  instructors ? instructorId : userId,
      // Módulos deseleccionados → solo se generarán los demás en los proyectos.
      modulos_excluidos: [...excluidos],
    } as any);
  };

  return (
    <div className="px-6 md:px-10 py-8 max-w-5xl animate-[fadeIn_0.2s_ease-out]">

      {/* ── Cabecera ──────────────────────────────────────────────────── */}
      <div className="border-b border-zinc-600/80 pb-3 mb-6">
        <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
          <Plus className="text-blue-400" size={18} /> Crear nueva ficha
        </h2>
        <p className="text-[13px] text-zinc-400 font-medium mt-0.5">
          Selecciona el tipo de formación. Los trimestres lectivos y sus módulos predeterminados se generarán automáticamente siguiendo el ciclo de vida del software (SDLC).
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── Columna izquierda: campos del formulario ───────────────── */}
        <div className="lg:col-span-2 space-y-5 bg-zinc-900 p-5 rounded-lg border border-zinc-700/60 h-fit">

          {/* Selector de tipo */}
          <div className="space-y-2">
            <label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">Tipo de formación</label>
            <div className="grid grid-cols-1 gap-2">
              {TIPOS.map(t => {
                const Icon = t.icon;
                const active = tipo === t.key;
                return (
                  <button
                    type="button"
                    key={t.key}
                    onClick={() => cambiarTipo(t.key)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all ${
                      active
                        ? 'bg-blue-500/15 border-blue-500/40 text-blue-300 shadow-md shadow-blue-900/30'
                        : 'bg-zinc-800/40 border-zinc-700 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${active ? 'bg-blue-500/20' : 'bg-zinc-800'}`}>
                      <Icon size={16} className={active ? 'text-blue-300' : 'text-zinc-400'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black">{t.label}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">{t.sublabel}</p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">{t.detalle}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Código */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">Código de la ficha</label>
            <input
              required
              value={codigo}
              onChange={e => setCodigo(e.target.value)}
              placeholder="Ej: 2670687"
              className="w-full bg-zinc-900 border border-zinc-600 rounded-md px-3 py-2 text-[13px] text-zinc-100 outline-none hover:bg-zinc-800 focus:bg-zinc-800 focus:border-blue-600 transition-colors placeholder-zinc-600"
            />
          </div>

          {/* Programa */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">Programa de formación</label>
            <input
              required
              value={programa}
              onChange={e => setPrograma(e.target.value)}
              placeholder={tipo === 'tecnologo' ? 'Ej: Análisis y Desarrollo de Software' : 'Ej: Programación de Software'}
              className="w-full bg-zinc-900 border border-zinc-600 rounded-md px-3 py-2 text-[13px] text-zinc-100 outline-none hover:bg-zinc-800 focus:bg-zinc-800 focus:border-blue-600 transition-colors placeholder-zinc-600"
            />
          </div>

          {/* Selector de instructor — sólo modo coordinador */}
          {instructors && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">Instructor encargado</label>
              <select
                required
                value={instructorId ?? ''}
                onChange={e => setInstructorId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full bg-zinc-900 border border-zinc-600 rounded-md px-3 py-2 text-[13px] text-zinc-300 outline-none hover:bg-zinc-800 focus:bg-zinc-800 focus:border-blue-600 transition-colors cursor-pointer"
              >
                <option value="">Selecciona un instructor</option>
                {instructors.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
              </select>
            </div>
          )}

          {/* Fecha de inicio */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">Fecha de inicio</label>
            <input
              required
              type="date"
              value={fechaInicio}
              onChange={e => setFechaInicio(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-600 rounded-md px-3 py-2 text-[13px] text-zinc-300 outline-none focus:border-blue-600 transition-colors"
            />
            <p className="text-[10px] text-zinc-500">
              Los trimestres se encadenan automáticamente desde esta fecha.
            </p>
          </div>

          {/* Jornada — visible para aprendices que se auto-registren */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">Jornada</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: 'mañana', label: 'Mañana', emoji: '🌅' },
                { key: 'tarde',  label: 'Tarde',  emoji: '☀️' },
                { key: 'noche',  label: 'Noche',  emoji: '🌙' },
              ] as const).map(j => {
                const active = jornada === j.key;
                return (
                  <button
                    type="button"
                    key={j.key}
                    onClick={() => setJornada(j.key)}
                    className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-md border text-center transition-all ${
                      active
                        ? 'bg-blue-500/15 border-blue-500/40 text-blue-300 shadow-md shadow-blue-900/30'
                        : 'bg-zinc-800/40 border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:bg-zinc-800'
                    }`}
                  >
                    <span className="text-[14px]">{j.emoji}</span>
                    <span className="text-[11px] font-black uppercase tracking-widest">{j.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-zinc-500">
              Los aprendices que se autoregistren deben indicar esta jornada.
            </p>
          </div>

          {/* Resumen calculado */}
          <div className="bg-zinc-800/40 border border-zinc-700/60 rounded-lg p-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <Calendar size={11} className="text-zinc-500" />
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Resumen</span>
            </div>
            <p className="text-[12px] text-zinc-300">
              <span className="text-zinc-500">Trimestres lectivos:</span>{' '}
              <span className="font-black text-blue-400">{plantilla.length}</span>
            </p>
            <p className="text-[12px] text-zinc-300">
              <span className="text-zinc-500">Duración:</span>{' '}
              <span className="font-black text-blue-400">{plantilla.length * 3} meses</span> ({plantilla.length * 12} semanas)
            </p>
            <p className="text-[12px] text-zinc-300">
              <span className="text-zinc-500">Módulos a crear:</span>{' '}
              <span className="font-black text-blue-400">{totalSeleccionados}</span>
              <span className="text-zinc-500"> de {totalModulos}</span>
            </p>
            <p className="text-[12px] text-zinc-300">
              <span className="text-zinc-500">Inicio:</span>{' '}
              <span className="font-bold">{fmt(fechaInicio)}</span>
            </p>
            <p className="text-[12px] text-zinc-300">
              <span className="text-zinc-500">Fin estimado:</span>{' '}
              <span className="font-bold">{fmt(fechaFinTotal)}</span>
            </p>
          </div>

          {createMut.isError && (
            <div className="px-3 py-2 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-start gap-2">
              <AlertTriangle size={13} className="text-rose-400 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-400 font-bold">
                {(createMut.error as any)?.response?.data?.message || 'Error al crear la ficha.'}
              </p>
            </div>
          )}

          {/* Error de creación (ej: código duplicado) */}
          {createError && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-rose-500/10 border border-rose-500/25 rounded-lg">
              <AlertTriangle size={14} className="text-rose-400 shrink-0" />
              <p className="text-[13px] text-rose-400 font-medium">{createError}</p>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2 border-t border-zinc-700/60">
            <button
              type="submit"
              disabled={createMut.isPending}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
            >
              {createMut.isPending
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creando...</>
                : <><Plus size={15} /> Crear ficha</>}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-3 border border-zinc-600 text-zinc-400 hover:text-zinc-200 font-bold rounded-lg transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>

        {/* ── Columna derecha: preview de trimestres + módulos ────────── */}
        <div className="lg:col-span-3">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={14} className="text-blue-400" />
            <h3 className="text-sm font-black text-zinc-200 uppercase tracking-widest">
              Trimestres y módulos predeterminados
            </h3>
          </div>
          <p className="text-[12px] text-zinc-500 mb-4">
            Cada trimestre trae módulos predeterminados del ciclo de vida del software. Vienen <span className="text-zinc-300 font-bold">todos seleccionados</span>: <span className="text-zinc-300 font-bold">desmarca</span> los que no quieras en esta ficha. Solo los seleccionados se crearán en los proyectos.
          </p>

          {loadingPlantilla ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-20 bg-zinc-800/40 rounded-lg animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {trimestresConFechas.map((t, i) => {
                const isExpanded = expandedTrim === i;
                const isDocumental = t.tipo === 'documental';
                const selCount = t.modulos.filter((_, mi) => !excluidos.has(`${i}:${mi}`)).length;
                const todosSel = selCount === t.modulos.length;
                return (
                  <div
                    key={i}
                    className="bg-zinc-900 border border-zinc-700/60 rounded-lg overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedTrim(isExpanded ? null : i)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/40 transition-colors text-left"
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-black text-sm ${
                        isDocumental ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {t.numero}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[13px] font-black text-zinc-100 truncate">{t.nombre}</p>
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-widest ${
                            isDocumental
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/25'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                          }`}>
                            {isDocumental ? <><FileText size={9} className="inline mr-0.5" /> Documental</> : <><Code size={9} className="inline mr-0.5" /> Desarrollo</>}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-0.5">
                          {fmt(t.fecha_inicio)} → {fmt(t.fecha_fin)} ·{' '}
                          <span className={selCount === 0 ? 'text-amber-400 font-bold' : ''}>
                            {selCount}/{t.modulos.length} módulo{t.modulos.length !== 1 ? 's' : ''} seleccionado{selCount !== 1 ? 's' : ''}
                          </span>
                        </p>
                      </div>
                      <ChevronDown size={14} className={`text-zinc-600 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-3 pt-1 border-t border-zinc-800 space-y-2">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-[11px] text-zinc-400 italic">{t.descripcion}</p>
                          <button
                            type="button"
                            onClick={() => setTrimestreTodos(i, t.modulos.length, !todosSel)}
                            className="shrink-0 text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            {todosSel ? 'Quitar todos' : 'Seleccionar todos'}
                          </button>
                        </div>
                        {t.modulos.map((m, mi) => {
                          const sel = !excluidos.has(`${i}:${mi}`);
                          return (
                            <button
                              type="button"
                              key={mi}
                              onClick={() => toggleModulo(i, mi)}
                              className={`w-full flex items-start gap-2.5 px-3 py-2 rounded-md border text-left transition-all ${
                                sel
                                  ? 'bg-zinc-800/30 border-zinc-700/40 hover:border-zinc-600'
                                  : 'bg-zinc-900/40 border-zinc-800 opacity-50 hover:opacity-75'
                              }`}
                            >
                              {/* Checkbox visual */}
                              <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-colors ${
                                sel ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-zinc-800 border-zinc-700 text-transparent'
                              }`}>
                                {sel && <Check size={12} strokeWidth={3} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className={`text-[12px] font-bold ${sel ? 'text-zinc-200' : 'text-zinc-500 line-through'}`}>{m.nombre}</p>
                                  <span className="text-[9px] font-black text-zinc-500 bg-zinc-800 border border-zinc-700/60 px-1.5 py-0.5 rounded">
                                    {m.semanas} sem
                                  </span>
                                  {m.requiere_adjunto && (
                                    <span className="text-[9px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 rounded">
                                      📎 entregable
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{m.descripcion}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </form>
    </div>
  );
};
