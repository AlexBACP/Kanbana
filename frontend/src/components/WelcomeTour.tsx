/**
 * WelcomeTour — Tour interactivo de bienvenida estilo Figma.
 *
 * Se muestra automáticamente la primera vez que un usuario entra a la
 * plataforma (tour_completado=false en BD). Resalta elementos reales de
 * la UI con tooltips explicativos.
 *
 * Tours específicos por ROL:
 *   - APRENDIZ       (~10 pasos)
 *   - LÍDER TÉCNICO  (~12 pasos)
 *   - INSTRUCTOR     (~10 pasos)
 *   - COORDINADOR    (~9 pasos)
 *
 * Diseño custom: usa TourTooltip en lugar del default de Joyride.
 * Locale 100% en español.
 */
import { useState, useEffect, ReactNode } from 'react';
import Joyride, { Step, STATUS, TooltipRenderProps } from 'react-joyride';
import {
  ArrowLeft, ArrowRight, X, Check, Sparkles,
} from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import { userService } from '../services/user.service';

// ═══════════════════════════════════════════════════════════════════════════
// TOOLTIP CUSTOM — diseño Kanbana
// ═══════════════════════════════════════════════════════════════════════════
const TourTooltip = ({
  backProps, closeProps, index, primaryProps, skipProps, step, tooltipProps, size,
}: TooltipRenderProps) => {
  const isFirst = index === 0;
  const isLast  = index === size - 1;
  const accent  = (step as any).accent ?? 'blue';

  // Colores por acento
  const accentMap: Record<string, { bar: string; bg: string; text: string; border: string; glow: string }> = {
    blue:    { bar: 'bg-blue-500',    bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'border-blue-500/30',    glow: 'shadow-blue-500/20'   },
    emerald: { bar: 'bg-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', glow: 'shadow-emerald-500/20' },
    amber:   { bar: 'bg-amber-500',   bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'border-amber-500/30',   glow: 'shadow-amber-500/20'  },
    rose:    { bar: 'bg-rose-500',    bg: 'bg-rose-500/10',    text: 'text-rose-400',    border: 'border-rose-500/30',    glow: 'shadow-rose-500/20'   },
    violet:  { bar: 'bg-violet-500',  bg: 'bg-violet-500/10',  text: 'text-violet-400',  border: 'border-violet-500/30',  glow: 'shadow-violet-500/20' },
    cyan:    { bar: 'bg-cyan-500',    bg: 'bg-cyan-500/10',    text: 'text-cyan-400',    border: 'border-cyan-500/30',    glow: 'shadow-cyan-500/20'   },
  };
  const a = accentMap[accent] ?? accentMap.blue;

  // Progreso
  const progress = Math.round(((index + 1) / size) * 100);

  return (
    <div
      {...tooltipProps}
      className={`relative bg-zinc-900 border ${a.border} rounded-2xl shadow-2xl ${a.glow} overflow-hidden max-w-md`}
      style={{ minWidth: 360 }}
    >
      {/* Barra de progreso superior */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-800">
        <div
          className={`h-full ${a.bar} transition-all duration-500 ease-out`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Botón cerrar (esquina) */}
      <button
        {...closeProps as any}
        title="Cerrar tour"
        className="absolute top-3 right-3 p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors z-10"
      >
        <X size={14} />
      </button>

      {/* Cuerpo */}
      <div className="p-6 pt-7">
        {/* Header: icono + numerito */}
        <div className="flex items-start gap-3 mb-4">
          <div className={`shrink-0 w-10 h-10 rounded-xl ${a.bg} ${a.border} border flex items-center justify-center`}>
            <Sparkles size={18} className={a.text} />
          </div>
          <div className="flex-1 min-w-0 pr-6">
            <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${a.text} mb-0.5`}>
              Paso {index + 1} de {size}
            </p>
            {(step as any).title && (
              <h3 className="text-[16px] font-black text-white leading-tight">
                {(step as any).title as ReactNode}
              </h3>
            )}
          </div>
        </div>

        {/* Contenido */}
        <div className="text-[13px] text-zinc-300 leading-relaxed">
          {step.content as ReactNode}
        </div>

        {/* Dots de progreso */}
        <div className="flex items-center justify-center gap-1.5 mt-5 mb-4">
          {Array.from({ length: size }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === index
                  ? `w-6 ${a.bar}`
                  : i < index
                    ? `w-1.5 ${a.bar} opacity-50`
                    : 'w-1.5 bg-zinc-700'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Footer: botones */}
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-zinc-800 bg-zinc-950/40">
        {/* Saltar */}
        {!isLast ? (
          <button
            {...skipProps as any}
            className="text-[12px] font-bold text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Saltar tour
          </button>
        ) : <span />}

        <div className="flex items-center gap-2">
          {/* Atrás */}
          {!isFirst && (
            <button
              {...backProps as any}
              className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-black text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <ArrowLeft size={12} /> Atrás
            </button>
          )}

          {/* Siguiente / Empezar */}
          <button
            {...primaryProps as any}
            className={`flex items-center gap-1.5 px-4 py-2 text-[12px] font-black text-white rounded-lg transition-all shadow-md ${a.bar} hover:opacity-90 active:scale-95`}
          >
            {isLast
              ? <><Check size={13} /> ¡Listo!</>
              : isFirst
                ? <>Empezar <ArrowRight size={12} /></>
                : <>Siguiente <ArrowRight size={12} /></>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// CONTENIDO DE LOS TOURS POR ROL
// ═══════════════════════════════════════════════════════════════════════════

// Helper: paso centrado en pantalla (sin elemento que apuntar)
const centered = (props: Partial<Step> & { accent?: string }): Step => ({
  target: 'body',
  placement: 'center',
  disableBeacon: true,
  ...props,
} as Step);

// Helper: paso anclado a un elemento del DOM
const pointer = (target: string, props: Partial<Step> & { accent?: string }): Step => ({
  target,
  disableBeacon: true,
  ...props,
} as Step);

// ── APRENDIZ — 10 pasos ────────────────────────────────────────────────────
const APRENDIZ_STEPS: Step[] = [
  centered({
    title: '¡Bienvenido a Kanbana! 👋',
    accent: 'blue',
    content: (
      <div>
        <p className="mb-2">Soy <strong className="text-blue-400">KanbanaAI</strong>, te acompaño en este recorrido rápido por la plataforma.</p>
        <p className="text-zinc-400 text-[12px]">En menos de 2 minutos conocerás todo lo importante. Puedes saltarlo cuando quieras y volver a verlo desde tu perfil.</p>
      </div>
    ),
  }),
  pointer('.kanbana-sidebar', {
    title: 'Tu menú lateral',
    accent: 'blue',
    placement: 'right',
    content: (
      <div>
        <p>Desde aquí navegas por toda la plataforma:</p>
        <ul className="mt-2 space-y-1 text-[12px] text-zinc-400">
          <li>📋 <strong className="text-zinc-200">Tablero</strong> — tus tareas pendientes</li>
          <li>✅ <strong className="text-zinc-200">Mis Tareas</strong> — solo lo asignado a ti</li>
          <li>🔗 <strong className="text-zinc-200">Recursos</strong> — links del proyecto</li>
          <li>🔔 <strong className="text-zinc-200">Notificaciones</strong></li>
        </ul>
      </div>
    ),
  }),
  pointer('#topbar-bell', {
    title: 'Notificaciones en tiempo real',
    accent: 'amber',
    placement: 'bottom',
    content: (
      <div>
        <p>Aquí llegan las novedades importantes:</p>
        <ul className="mt-2 space-y-1 text-[12px] text-zinc-400">
          <li>📨 Cuando te asignan una tarea</li>
          <li>💬 Comentarios en tus tareas</li>
          <li>✅ Tu trabajo aprobado o rechazado</li>
          <li>⏰ Tareas próximas a vencer</li>
        </ul>
        <p className="mt-2 text-[12px] text-amber-400">Aparecen como ventanas emergentes al instante.</p>
      </div>
    ),
  }),
  centered({
    title: 'Tu día a día en Kanbana',
    accent: 'emerald',
    content: (
      <div>
        <p className="mb-2">Cada tarea pasa por <strong>4 estados</strong>:</p>
        <div className="space-y-1.5 text-[12px]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-zinc-500" />
            <span><strong className="text-zinc-300">Por hacer</strong> — la tarea está esperando</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span><strong className="text-zinc-300">En desarrollo</strong> — estás trabajando en ella</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span><strong className="text-zinc-300">En revisión</strong> — la enviaste para que la revisen</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span><strong className="text-zinc-300">Finalizado</strong> — aprobada ✓</span>
          </div>
        </div>
      </div>
    ),
  }),
  centered({
    title: 'Cómo trabajar una tarea',
    accent: 'blue',
    content: (
      <div>
        <p className="mb-2">El flujo típico es:</p>
        <ol className="space-y-1.5 text-[12px] text-zinc-300 list-decimal list-inside">
          <li>Tomas una tarea del <strong>tablero</strong></li>
          <li>Trabajas en ella (código, evidencia, etc.)</li>
          <li>Si requiere adjunto, lo subes en la pestaña <strong className="text-blue-400">Adjuntos</strong></li>
          <li>Marcas <strong className="text-emerald-400">"Listo para revisión"</strong></li>
          <li>Tu líder técnico la aprueba o pide correcciones</li>
        </ol>
      </div>
    ),
  }),
  centered({
    title: 'El código KAN-XXXXX 🎯',
    accent: 'cyan',
    content: (
      <div>
        <p className="mb-2">Cada tarea tiene un <strong className="text-cyan-400 font-mono">código único</strong> de 5 dígitos, por ejemplo:</p>
        <div className="bg-zinc-950 border border-cyan-500/20 rounded-lg p-3 text-center mb-2">
          <code className="text-cyan-400 font-mono font-black text-base">KAN-58329</code>
        </div>
        <p className="text-[12px]">Lo encuentras en la cabecera del detalle de cada tarea con un botón para copiarlo.</p>
      </div>
    ),
  }),
  centered({
    title: 'Integración con GitHub 🔌',
    accent: 'violet',
    content: (
      <div>
        <p className="mb-2">Si conectas tu cuenta GitHub, tus commits mueven las tareas <strong>automáticamente</strong>:</p>
        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 mb-2">
          <code className="text-[11px] text-violet-300">git commit -m <span className="text-emerald-400">"KAN-58329 implementa login"</span></code>
        </div>
        <p className="text-[12px] text-zinc-400">→ La tarea pasa de "Por hacer" a "En desarrollo" sola.</p>
        <p className="text-[12px] text-zinc-400">→ Al abrir un PR pasa a "En revisión".</p>
        <p className="text-[12px] text-zinc-400">→ Al mergear pasa a "Finalizado".</p>
      </div>
    ),
  }),
  centered({
    title: 'Atajos que te ahorran tiempo ⌨️',
    accent: 'amber',
    content: (
      <div>
        <p className="mb-2">Memoriza estos:</p>
        <ul className="space-y-1.5 text-[12px]">
          <li className="flex items-center gap-2">
            <kbd className="px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] font-mono text-zinc-300">Ctrl + K</kbd>
            <span className="text-zinc-400">Búsqueda global de tareas y proyectos</span>
          </li>
          <li className="flex items-center gap-2">
            <kbd className="px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] font-mono text-zinc-300">Esc</kbd>
            <span className="text-zinc-400">Cerrar cualquier modal o panel</span>
          </li>
        </ul>
      </div>
    ),
  }),
  centered({
    title: 'KanbanaAI siempre disponible 💬',
    accent: 'emerald',
    content: (
      <div>
        <p className="mb-2">Verás una <strong className="text-emerald-400">burbuja flotante</strong> abajo a la derecha.</p>
        <p className="text-[12px] text-zinc-400">Soy tu asistente de IA: pregúntame cualquier duda — cómo hacer algo, qué significa un término, ayuda con tareas, lo que sea.</p>
      </div>
    ),
  }),
  centered({
    title: '¡Estás listo! 🚀',
    accent: 'emerald',
    content: (
      <div>
        <p className="mb-2"><strong className="text-emerald-400">¡Eso es todo!</strong> Ya conoces lo esencial.</p>
        <p className="text-[12px] text-zinc-400">Puedes volver a ver este tour cuando quieras desde <strong className="text-zinc-200">Perfil → Ver tutorial</strong>.</p>
        <p className="text-[12px] text-zinc-500 mt-2">¡A construir algo genial! 💪</p>
      </div>
    ),
  }),
];

// ── LÍDER TÉCNICO — 12 pasos ──────────────────────────────────────────────
const LIDER_STEPS: Step[] = [
  centered({
    title: '¡Bienvenido, Líder Técnico! 🛡️',
    accent: 'emerald',
    content: (
      <div>
        <p className="mb-2">Eres el <strong className="text-emerald-400">aprendiz-líder</strong> de tu equipo: coordinas las tareas y la entrega del módulo.</p>
        <p className="text-[12px] text-zinc-400">Te muestro las herramientas que solo tú tienes acceso. Toma menos de 3 minutos.</p>
      </div>
    ),
  }),
  pointer('.kanbana-sidebar', {
    title: 'Tu panel de líder',
    accent: 'emerald',
    placement: 'right',
    content: (
      <div>
        <p className="mb-2">Como líder ves opciones extra en el menú:</p>
        <ul className="space-y-1 text-[12px] text-zinc-400">
          <li>📊 <strong className="text-zinc-200">Panel de control</strong> — métricas del equipo</li>
          <li>📁 <strong className="text-zinc-200">Mi Proyecto</strong> — gestión completa</li>
          <li>🔗 <strong className="text-zinc-200">Recursos</strong> — links, repos, archivos</li>
        </ul>
      </div>
    ),
  }),
  centered({
    title: 'Tu rol y responsabilidades 🎯',
    accent: 'emerald',
    content: (
      <div>
        <p className="mb-2">Como líder técnico tú:</p>
        <ul className="space-y-1.5 text-[12px] text-zinc-300">
          <li>✅ <strong>Creas tareas</strong> y las asignas a tu equipo</li>
          <li>👀 <strong>Revisas el trabajo</strong> de los aprendices (aprobar/rechazar)</li>
          <li>📦 <strong>Envías el módulo</strong> al instructor cuando está completo</li>
          <li>📨 <strong>Solicitas módulos</strong> al instructor si necesitas crear uno</li>
          <li>🔌 <strong>Vinculas repos</strong> de GitHub al proyecto</li>
        </ul>
      </div>
    ),
  }),
  centered({
    title: 'Crear y asignar tareas 📋',
    accent: 'blue',
    content: (
      <div>
        <p className="mb-2">Tú tienes el botón <strong className="text-blue-400">"Nueva tarea"</strong> en el tablero y en la cola de trabajo.</p>
        <p className="text-[12px] text-zinc-400 mb-2">Al crearla puedes:</p>
        <ul className="space-y-1 text-[12px] text-zinc-400">
          <li>• Elegir el <strong className="text-zinc-200">módulo activo</strong> donde irá</li>
          <li>• Asignarla a un <strong className="text-zinc-200">aprendiz específico</strong></li>
          <li>• Definir prioridad, fecha límite y story points</li>
          <li>• Dejarla "sin asignar" para que alguien la tome</li>
        </ul>
      </div>
    ),
  }),
  centered({
    title: 'Revisar el trabajo del equipo 👀',
    accent: 'amber',
    content: (
      <div>
        <p className="mb-2">Cuando un aprendiz marca una tarea como lista:</p>
        <ul className="space-y-1.5 text-[12px] text-zinc-400">
          <li>🟢 La tarjeta aparece <strong className="text-emerald-400">verde "Listo"</strong> en el tablero</li>
          <li>📨 Recibes una notificación al instante</li>
        </ul>
        <p className="mt-2 text-[12px]">Puedes:</p>
        <ul className="space-y-1 text-[12px] text-zinc-400">
          <li>✅ <strong className="text-emerald-400">Aprobar</strong> → pasa a "Finalizado"</li>
          <li>↩ <strong className="text-rose-400">Rechazar con motivo</strong> → vuelve al aprendiz con correcciones visibles</li>
        </ul>
      </div>
    ),
  }),
  centered({
    title: 'Solicitar nuevos módulos 📨',
    accent: 'violet',
    content: (
      <div>
        <p className="mb-2">No puedes crear módulos directamente, pero sí <strong className="text-violet-400">solicitarlos</strong> al instructor.</p>
        <p className="text-[12px] text-zinc-400">Ve a <strong className="text-zinc-200">Cola de trabajo → Solicitar módulo</strong>. El instructor recibe la solicitud y decide aprobar o rechazar.</p>
      </div>
    ),
  }),
  centered({
    title: 'Permisos temporales 🔓',
    accent: 'cyan',
    content: (
      <div>
        <p className="mb-2">Para casos especiales puedes pedir <strong className="text-cyan-400">permisos temporales</strong>:</p>
        <ul className="space-y-1 text-[12px] text-zinc-400">
          <li>📅 Editar fechas/nombres de trimestres</li>
          <li>📦 Crear módulos directamente</li>
        </ul>
        <p className="mt-2 text-[12px]">El instructor decide cuántos días te concede el permiso.</p>
      </div>
    ),
  }),
  centered({
    title: 'Enviar módulo a revisión 📦',
    accent: 'amber',
    content: (
      <div>
        <p className="mb-2">Cuando todas las tareas del módulo estén en <strong className="text-emerald-400">"Finalizado"</strong>:</p>
        <ol className="space-y-1 text-[12px] text-zinc-300 list-decimal list-inside">
          <li>Verifica que los adjuntos requeridos estén subidos</li>
          <li>Clic en <strong>"Cerrar módulo"</strong></li>
          <li>El instructor lo revisa y aprueba o pide correcciones</li>
        </ol>
      </div>
    ),
  }),
  pointer('#topbar-bell', {
    title: 'Notificaciones críticas',
    accent: 'rose',
    placement: 'bottom',
    content: (
      <div>
        <p className="mb-2">Como líder, te llegan notificaciones especiales:</p>
        <ul className="space-y-1 text-[12px] text-zinc-400">
          <li>🟢 Tarea lista para revisar</li>
          <li>⏰ Tareas de tu equipo vencidas</li>
          <li>✓ Permisos aprobados/rechazados</li>
          <li>📦 Módulos aprobados o con correcciones</li>
        </ul>
      </div>
    ),
  }),
  centered({
    title: 'Vincular GitHub al proyecto 🔌',
    accent: 'violet',
    content: (
      <div>
        <p className="mb-2">Eres uno de los pocos roles que puede vincular el <strong>repositorio del proyecto</strong>.</p>
        <p className="text-[12px] text-zinc-400 mb-2">Pasos:</p>
        <ol className="space-y-1 text-[12px] text-zinc-300 list-decimal list-inside">
          <li>Conecta tu cuenta GitHub desde <strong>Perfil</strong></li>
          <li>Entra al proyecto → sección <strong>Repositorios</strong></li>
          <li>Selecciona el repo y vincúlalo</li>
        </ol>
        <p className="mt-2 text-[12px] text-zinc-500">Los commits con <code className="text-violet-400">KAN-XXXXX</code> moverán las tareas solos.</p>
      </div>
    ),
  }),
  centered({
    title: 'KanbanaAI te ayuda 💬',
    accent: 'emerald',
    content: (
      <div>
        <p className="mb-2">Tienes acceso al asistente IA con la <strong className="text-emerald-400">burbuja flotante</strong> abajo a la derecha.</p>
        <p className="text-[12px] text-zinc-400">Conoce TODO sobre la plataforma. Pregunta cualquier cosa: cómo hacer X, qué significa Y, ayuda con tu equipo.</p>
      </div>
    ),
  }),
  centered({
    title: '¡A liderar! 🚀',
    accent: 'emerald',
    content: (
      <div>
        <p className="mb-2">Ya conoces todas las herramientas de líder técnico.</p>
        <p className="text-[12px] text-zinc-400">Recuerda: tu rol clave es <strong className="text-emerald-400">coordinar y desbloquear</strong> a tu equipo.</p>
        <p className="text-[12px] text-zinc-500 mt-2">Puedes volver a ver este tour desde <strong className="text-zinc-200">Perfil → Ver tutorial</strong>.</p>
      </div>
    ),
  }),
];

// ── INSTRUCTOR — 10 pasos ──────────────────────────────────────────────────
const INSTRUCTOR_STEPS: Step[] = [
  centered({
    title: '¡Bienvenido, Instructor! 👨‍🏫',
    accent: 'cyan',
    content: (
      <div>
        <p className="mb-2">Eres el <strong className="text-cyan-400">responsable formativo</strong>: gestionas tus fichas, proyectos y supervisas el avance de tus aprendices.</p>
        <p className="text-[12px] text-zinc-400">Te muestro las funciones clave en 3 minutos.</p>
      </div>
    ),
  }),
  pointer('.kanbana-sidebar', {
    title: 'Tu panel de instructor',
    accent: 'cyan',
    placement: 'right',
    content: (
      <div>
        <p className="mb-2">Tu menú lateral incluye:</p>
        <ul className="space-y-1 text-[12px] text-zinc-400">
          <li>📊 <strong className="text-zinc-200">Panel de control</strong> — vista general</li>
          <li>📁 <strong className="text-zinc-200">Mis Proyectos</strong> — todos tus proyectos</li>
          <li>🎓 <strong className="text-zinc-200">Mis Fichas</strong> — grupos formativos</li>
        </ul>
      </div>
    ),
  }),
  centered({
    title: 'Gestionar fichas y aprendices 🎓',
    accent: 'cyan',
    content: (
      <div>
        <p className="mb-2">Desde <strong>Mis Fichas</strong> puedes:</p>
        <ul className="space-y-1 text-[12px] text-zinc-400">
          <li>👤 Agregar aprendices uno a uno</li>
          <li>📊 Importar masivamente desde Excel</li>
          <li>✅ Aprobar/rechazar solicitudes de vinculación</li>
          <li>🔑 Cambiar contraseñas de tus aprendices</li>
          <li>👁 Ver detalles del perfil de cada uno</li>
        </ul>
      </div>
    ),
  }),
  centered({
    title: 'Crear proyectos 📁',
    accent: 'blue',
    content: (
      <div>
        <p className="mb-2">Desde una ficha, creas <strong className="text-blue-400">proyectos formativos</strong> y configuras:</p>
        <ul className="space-y-1 text-[12px] text-zinc-400">
          <li>📅 Trimestres (mínimo 3, máximo 10)</li>
          <li>📦 Módulos por trimestre (sprints)</li>
          <li>👤 Asignas a un <strong className="text-emerald-400">Líder Técnico</strong> del equipo</li>
        </ul>
        <p className="mt-2 text-[12px] text-zinc-500">Tip: cada módulo puede ser tipo <strong>Documental</strong> (requiere evidencia) o <strong>Desarrollo</strong>.</p>
      </div>
    ),
  }),
  centered({
    title: 'Módulos: activar, revisar, cerrar 📦',
    accent: 'amber',
    content: (
      <div>
        <p className="mb-2">Tú controlas el ciclo de vida:</p>
        <ol className="space-y-1 text-[12px] text-zinc-300 list-decimal list-inside">
          <li><strong className="text-amber-400">Planificado</strong> → activas el módulo cuando arranca</li>
          <li><strong className="text-blue-400">Activo</strong> → equipo trabaja (puedes tener hasta 3 activos)</li>
          <li><strong className="text-emerald-400">En revisión</strong> → el líder lo envía completo</li>
          <li><strong className="text-zinc-400">Finalizado</strong> → tú apruebas o pides correcciones</li>
        </ol>
      </div>
    ),
  }),
  centered({
    title: 'Aprobar solicitudes 📨',
    accent: 'violet',
    content: (
      <div>
        <p className="mb-2">El líder técnico puede pedirte:</p>
        <ul className="space-y-1 text-[12px] text-zinc-400">
          <li>📦 <strong className="text-violet-400">Crear un módulo</strong> con justificación</li>
          <li>🔓 <strong className="text-violet-400">Permisos temporales</strong> (editar trimestres, etc.)</li>
        </ul>
        <p className="mt-2 text-[12px]">Las solicitudes llegan a tu campana 🔔 con botones inline de <strong className="text-emerald-400">Aceptar</strong> / <strong className="text-rose-400">Rechazar</strong>.</p>
      </div>
    ),
  }),
  pointer('#topbar-bell', {
    title: 'Solicitudes en tiempo real',
    accent: 'amber',
    placement: 'bottom',
    content: (
      <div>
        <p className="mb-2">Aquí llegan eventos importantes:</p>
        <ul className="space-y-1 text-[12px] text-zinc-400">
          <li>👤 Solicitudes de vinculación de aprendices</li>
          <li>📦 Módulos enviados a revisión</li>
          <li>🔓 Permisos solicitados por líderes</li>
          <li>⏰ Tareas vencidas en tus proyectos</li>
        </ul>
      </div>
    ),
  }),
  centered({
    title: 'Sugerencias IA de módulos ✨',
    accent: 'violet',
    content: (
      <div>
        <p className="mb-2">Al crear un módulo, Kanbana te sugiere ideas basadas en el contexto del proyecto:</p>
        <ul className="space-y-1 text-[12px] text-zinc-400">
          <li>🤖 Generadas por IA (Gemini)</li>
          <li>📚 O del catálogo SDLC estándar</li>
        </ul>
        <p className="mt-2 text-[12px]">Las descartas o las conviertes en módulos reales con un clic.</p>
      </div>
    ),
  }),
  centered({
    title: 'Vincular GitHub al proyecto 🔌',
    accent: 'violet',
    content: (
      <div>
        <p className="mb-2">Puedes vincular un repo al proyecto:</p>
        <ol className="space-y-1 text-[12px] text-zinc-300 list-decimal list-inside">
          <li>Conecta tu GitHub en <strong>Perfil</strong></li>
          <li>Entra al proyecto → <strong>Repositorios</strong></li>
          <li>Selecciona el repo</li>
        </ol>
        <p className="mt-2 text-[12px] text-zinc-500">Los commits con <code className="text-violet-400">KAN-XXXXX</code> mueven las tareas automáticamente.</p>
      </div>
    ),
  }),
  centered({
    title: '¡A formar! 🎓',
    accent: 'cyan',
    content: (
      <div>
        <p className="mb-2">Ya conoces todas las herramientas del instructor.</p>
        <p className="text-[12px] text-zinc-400">Tu asistente <strong className="text-cyan-400">KanbanaAI</strong> conoce todos los flujos. No dudes en preguntarle.</p>
        <p className="text-[12px] text-zinc-500 mt-2">Puedes volver a ver este tour desde <strong className="text-zinc-200">Perfil → Ver tutorial</strong>.</p>
      </div>
    ),
  }),
];

// ── COORDINADOR — 9 pasos ──────────────────────────────────────────────────
const COORDINADOR_STEPS: Step[] = [
  centered({
    title: '¡Bienvenido, Coordinador! 🛡️',
    accent: 'blue',
    content: (
      <div>
        <p className="mb-2">Tienes <strong className="text-blue-400">acceso total</strong>: administras toda la plataforma, usuarios, fichas y proyectos.</p>
        <p className="text-[12px] text-zinc-400">Te muestro lo esencial en 2 minutos.</p>
      </div>
    ),
  }),
  pointer('.kanbana-sidebar', {
    title: 'Tu panel maestro',
    accent: 'blue',
    placement: 'right',
    content: (
      <div>
        <p className="mb-2">Acceso a todo el sistema:</p>
        <ul className="space-y-1 text-[12px] text-zinc-400">
          <li>📊 <strong className="text-zinc-200">Panel de control</strong> — métricas globales</li>
          <li>📁 <strong className="text-zinc-200">Proyectos</strong> — todos los proyectos</li>
          <li>🎓 <strong className="text-zinc-200">Fichas SENA</strong> — todas las fichas</li>
          <li>👥 <strong className="text-zinc-200">Usuarios</strong> — coordinadores, instructores, aprendices</li>
          <li>🛡️ <strong className="text-zinc-200">Líderes técnicos</strong> — vista especial</li>
        </ul>
      </div>
    ),
  }),
  centered({
    title: 'Gestión total de usuarios 👥',
    accent: 'cyan',
    content: (
      <div>
        <p className="mb-2">Desde <strong>Usuarios</strong> puedes:</p>
        <ul className="space-y-1 text-[12px] text-zinc-400">
          <li>➕ Crear coordinadores, instructores y aprendices</li>
          <li>🔄 <strong className="text-cyan-400">Cambiar roles</strong> a cualquier usuario</li>
          <li>🔑 Resetear contraseñas (sin límite diario)</li>
          <li>🔄 Mover aprendices entre fichas</li>
          <li>🚫 Activar / desactivar cuentas</li>
        </ul>
      </div>
    ),
  }),
  centered({
    title: 'Crear fichas y asignar instructores 🎓',
    accent: 'blue',
    content: (
      <div>
        <p className="mb-2">Tú creas las <strong className="text-blue-400">fichas formativas</strong> y asignas un instructor responsable.</p>
        <p className="text-[12px] text-zinc-400 mb-2">Por ficha defines:</p>
        <ul className="space-y-1 text-[12px] text-zinc-400">
          <li>📝 Código y programa de formación</li>
          <li>🕐 Jornada (mañana / tarde / noche)</li>
          <li>📅 Fechas inicio y fin</li>
          <li>🎯 Tipo: tecnólogo (6 trim.) o técnico (3 trim.)</li>
        </ul>
      </div>
    ),
  }),
  centered({
    title: 'Aprobar instructores 👨‍🏫',
    accent: 'cyan',
    content: (
      <div>
        <p className="mb-2">Cuando un instructor se auto-registra con su correo <strong className="text-cyan-400">@sena.edu.co</strong>:</p>
        <ol className="space-y-1 text-[12px] text-zinc-300 list-decimal list-inside">
          <li>Confirma su correo institucional</li>
          <li>Queda pendiente de tu aprobación</li>
          <li>Tú revisas y apruebas o rechazas</li>
        </ol>
      </div>
    ),
  }),
  pointer('#topbar-bell', {
    title: 'Notificaciones globales',
    accent: 'amber',
    placement: 'bottom',
    content: (
      <div>
        <p className="mb-2">Recibes todo lo importante del sistema:</p>
        <ul className="space-y-1 text-[12px] text-zinc-400">
          <li>👨‍🏫 Nuevos instructores esperando aprobación</li>
          <li>📊 Importaciones masivas completadas</li>
          <li>🚨 Alertas críticas del sistema</li>
        </ul>
      </div>
    ),
  }),
  centered({
    title: 'Vista de Líderes Técnicos 🛡️',
    accent: 'emerald',
    content: (
      <div>
        <p className="mb-2">Tienes una vista exclusiva para ver todos los líderes activos en la plataforma.</p>
        <p className="text-[12px] text-zinc-400">Útil para detectar cuellos de botella, monitorear avance global y validar promociones de aprendices.</p>
      </div>
    ),
  }),
  centered({
    title: 'PQRS y reportes 📊',
    accent: 'violet',
    content: (
      <div>
        <p className="mb-2">Los mensajes <strong className="text-violet-400">PQRS</strong> (peticiones, quejas, reclamos, sugerencias) llegan a tu correo administrativo.</p>
        <p className="text-[12px] text-zinc-400">Cualquier visitante de la landing puede enviarlos desde la sección PQRS al pie.</p>
      </div>
    ),
  }),
  centered({
    title: '¡A coordinar! 🚀',
    accent: 'blue',
    content: (
      <div>
        <p className="mb-2">Ya conoces la plataforma desde el rol con más responsabilidad.</p>
        <p className="text-[12px] text-zinc-400">Si hay algo confuso, <strong className="text-blue-400">KanbanaAI</strong> conoce todos los flujos por rol y te puede guiar.</p>
        <p className="text-[12px] text-zinc-500 mt-2">Puedes volver a ver este tour desde <strong className="text-zinc-200">Perfil → Ver tutorial</strong>.</p>
      </div>
    ),
  }),
];

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════
interface Props {
  forced?: boolean;
  onClose?: () => void;
}

export const WelcomeTour = ({ forced = false, onClose }: Props) => {
  const { user, updateUser } = useAuthStore() as any;
  const [run, setRun] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (forced) { setRun(true); return; }
    if (user.tour_completado === true) return;

    const path = window.location.pathname;
    if (path === '/' || path.startsWith('/auth') || path.startsWith('/confirmar')) return;
    if (path.startsWith('/solicitar-vinculacion')) return;

    const t = setTimeout(() => setRun(true), 800);
    return () => clearTimeout(t);
  }, [user, forced]);

  // Elegir tour según rol
  const steps = (() => {
    if (!user) return [];
    if (user.rol === 'coordinador') return COORDINADOR_STEPS;
    if (user.rol === 'instructor')  return INSTRUCTOR_STEPS;
    if (user.rol === 'aprendiz' && user.es_lider_tecnico) return LIDER_STEPS;
    return APRENDIZ_STEPS;
  })();

  const handleCallback = async (data: any) => {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      try {
        await userService.setTourCompletado(true);
        if (updateUser) updateUser({ tour_completado: true });
      } catch (err) {
        console.warn('[WelcomeTour] No se pudo guardar:', err);
      }
      if (onClose) onClose();
    }
  };

  if (!user) return null;
  if (user.rol === 'aprendiz' && !user.es_lider_tecnico && !user.fichaId && !forced) return null;

  return (
    <Joyride
      run={run}
      steps={steps}
      callback={handleCallback}
      continuous
      showSkipButton
      disableOverlayClose
      hideBackButton={false}
      tooltipComponent={TourTooltip as any}
      styles={{
        options: {
          overlayColor: 'rgba(9, 9, 11, 0.78)',
          zIndex:       10000,
          arrowColor:   '#18181b',
        },
        spotlight: {
          borderRadius: 12,
        },
      }}
      locale={{
        back:  'Atrás',
        close: 'Cerrar',
        last:  '¡Listo!',
        next:  'Siguiente',
        skip:  'Saltar tour',
        open:  'Abrir',
      }}
    />
  );
};
