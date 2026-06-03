/**
 * SystemShowcase — Mockup animado del sistema (estilo "video") para la landing.
 *
 * Muestra una ventana con un tablero Kanban vivo (una tarjeta se mueve sola de
 * "Por hacer" a "En progreso" con un cursor que la arrastra), un toast de
 * notificación que aparece, avatares de presencia y una mini barra de métricas.
 * Alrededor de la ventana, las funcionalidades del sistema aparecen como
 * "callouts" señalados que se revelan con stagger al hacer scroll.
 *
 * Inspirado en los mockups del pitch (documentos/pitch) pero unificado en un
 * solo lienzo, con tema azul y framer-motion.
 */
import { motion } from 'framer-motion';
import type { ComponentType } from 'react';

export interface ShowcaseFeature {
  icon: ComponentType<{ size?: number | string; className?: string }>;
  title: string;
  desc: string;
}

const LOOP = 9; // duración del bucle del tablero (s)

// ── Callout señalado ──────────────────────────────────────────────────────────
const Callout = ({
  feature, side, delay,
}: { feature: ShowcaseFeature; side: 'left' | 'right'; delay: number }) => {
  const Icon = feature.icon;
  return (
    <motion.div
      initial={{ opacity: 0, x: side === 'left' ? -24 : 24 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ duration: 0.5, delay, ease: [0.4, 0, 0.2, 1] }}
      className={`group flex items-start gap-3 ${side === 'left' ? 'lg:flex-row-reverse lg:text-right' : ''}`}
    >
      {/* Punto pulsante "señalando" hacia el mockup */}
      <span className={`relative mt-3 hidden h-2 w-2 shrink-0 rounded-full bg-blue-500 lg:block`}>
        <span className="absolute inset-0 animate-ping rounded-full bg-blue-500/70" />
      </span>

      <div className={`flex items-start gap-3 ${side === 'left' ? 'flex-row-reverse text-right' : ''}`}>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-blue-500/25 bg-blue-600/15 text-blue-400 transition-all group-hover:scale-110 group-hover:bg-blue-600/25">
          <Icon size={18} />
        </div>
        <div>
          <h3 className="text-[14px] font-bold tracking-tight text-zinc-100">{feature.title}</h3>
          <p className="mt-1 max-w-[230px] text-[11.5px] leading-relaxed text-zinc-400">{feature.desc}</p>
        </div>
      </div>
    </motion.div>
  );
};

// ── Tarjeta estática del tablero ──────────────────────────────────────────────
const MkCard = ({ children, accent }: { children: React.ReactNode; accent?: string }) => (
  <div className={`rounded-md border border-white/8 bg-white/[0.06] px-2.5 py-1.5 text-[11px] leading-tight text-zinc-300 ${accent ?? ''}`}>
    {children}
  </div>
);

// ── Ventana mockup con tablero vivo ───────────────────────────────────────────
const Mockup = () => (
  <div className="relative mx-auto w-full max-w-[520px]">
    {/* Resplandor */}
    <div className="absolute -inset-6 -z-10 rounded-[36px] bg-blue-600/15 blur-3xl" />

    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
      className="overflow-hidden rounded-2xl border border-zinc-700/60 bg-zinc-950 shadow-2xl shadow-black/60"
    >
      {/* Barra de título (chrome) */}
      <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        <span className="ml-2 text-[11px] font-bold text-zinc-400">Kanbana · Sprint 3 — Módulo Auth</span>
        {/* Presencia (avatares) */}
        <div className="ml-auto flex -space-x-1.5">
          {['bg-blue-500', 'bg-violet-500', 'bg-emerald-500'].map((c, i) => (
            <span key={i} className={`h-5 w-5 rounded-full ${c} ring-2 ring-zinc-900 text-[8px] font-black text-white grid place-items-center`}>
              {['M', 'C', 'L'][i]}
            </span>
          ))}
        </div>
      </div>

      {/* Cuerpo: tablero */}
      <div className="relative h-[268px] bg-zinc-950 p-3">
        <div className="grid h-full grid-cols-3 gap-2.5">
          {/* Por hacer */}
          <div className="flex flex-col gap-2 rounded-lg bg-white/[0.02] p-2">
            <div className="rounded bg-zinc-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-zinc-400">Por hacer</div>
            <div className="h-[34px] rounded-md border border-dashed border-blue-500/25 bg-blue-500/5" />
            <MkCard>Validar formularios <span className="float-right text-[9px] font-bold text-amber-400">⚡</span></MkCard>
            <MkCard>Tests unitarios</MkCard>
          </div>
          {/* En progreso */}
          <div className="flex flex-col gap-2 rounded-lg bg-white/[0.02] p-2">
            <div className="rounded bg-blue-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-blue-400">En progreso</div>
            <MkCard>Middleware de roles</MkCard>
          </div>
          {/* Finalizado */}
          <div className="flex flex-col gap-2 rounded-lg bg-white/[0.02] p-2">
            <div className="rounded bg-emerald-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-400">Finalizado</div>
            <MkCard accent="opacity-70">Login / Registro ✓</MkCard>
            <MkCard accent="opacity-70">Guard JWT ✓</MkCard>
          </div>
        </div>

        {/* Tarjeta que se mueve sola: Por hacer → En progreso */}
        <motion.div
          className="absolute z-10 w-[28%] rounded-md border border-blue-500/50 bg-blue-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-100 shadow-lg shadow-blue-900/40"
          style={{ top: 70 }}
          initial={{ left: '4.5%' }}
          animate={{
            left:    ['4.5%', '4.5%', '37%', '37%', '37%', '4.5%', '4.5%'],
            scale:   [1, 1.05, 1.05, 1, 1, 1, 1],
            opacity: [1, 1, 1, 1, 1, 0, 1],
          }}
          transition={{ duration: LOOP, times: [0, 0.12, 0.42, 0.48, 0.9, 0.94, 1], repeat: Infinity, ease: 'easeInOut' }}
        >
          Endpoint refresh JWT <span className="float-right text-[9px] text-blue-300">🔥</span>
        </motion.div>

        {/* Cursor que "arrastra" la tarjeta */}
        <motion.div
          className="pointer-events-none absolute z-20"
          initial={{ left: '70%', top: '85%', opacity: 0 }}
          animate={{
            left:    ['70%', '14%', '14%', '46%', '70%', '70%'],
            top:     ['85%', '34%', '34%', '34%', '24%', '85%'],
            opacity: [0, 1, 1, 1, 1, 0],
          }}
          transition={{ duration: LOOP, times: [0, 0.1, 0.14, 0.46, 0.72, 1], repeat: Infinity, ease: 'easeInOut' }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" className="drop-shadow-lg">
            <path d="M2 2 L2 14 L6 10 L9 16 L11 15 L8 9 L14 9 Z" fill="#fff" stroke="#1e3a8a" strokeWidth="1" />
          </svg>
        </motion.div>

        {/* Toast de notificación (aparece cuando la tarjeta llega) */}
        <motion.div
          className="absolute bottom-3 right-3 z-20 flex items-center gap-2 rounded-lg border border-blue-500/30 bg-zinc-900/95 px-3 py-2 shadow-xl backdrop-blur"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: [0, 0, 1, 1, 0], x: [30, 30, 0, 0, 30] }}
          transition={{ duration: LOOP, times: [0, 0.45, 0.52, 0.82, 0.9], repeat: Infinity, ease: 'easeInOut' }}
        >
          <span className="grid h-5 w-5 place-items-center rounded-full bg-blue-500/20 text-[10px]">🔔</span>
          <span className="text-[10px] font-semibold text-zinc-200">"Endpoint refresh JWT" → En progreso</span>
        </motion.div>
      </div>

      {/* Pie: mini métricas */}
      <div className="flex items-center gap-3 border-t border-zinc-800 bg-zinc-900 px-4 py-2.5">
        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Avance</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400"
            initial={{ width: '40%' }}
            animate={{ width: ['40%', '40%', '62%', '62%'] }}
            transition={{ duration: LOOP, times: [0, 0.45, 0.6, 1], repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
        <span className="text-[10px] font-bold text-blue-400">62%</span>
      </div>
    </motion.div>
  </div>
);

// ── Componente principal ──────────────────────────────────────────────────────
export const SystemShowcase = ({ features }: { features: ShowcaseFeature[] }) => {
  const left  = features.slice(0, 3);
  const right = features.slice(3, 6);

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[1fr_auto_1fr]">
      {/* Callouts izquierda */}
      <div className="order-2 flex flex-col gap-7 lg:order-1 lg:items-end">
        {left.map((f, i) => (
          <Callout key={f.title} feature={f} side="left" delay={0.15 * i} />
        ))}
      </div>

      {/* Mockup central */}
      <div className="order-1 lg:order-2">
        <Mockup />
      </div>

      {/* Callouts derecha */}
      <div className="order-3 flex flex-col gap-7">
        {right.map((f, i) => (
          <Callout key={f.title} feature={f} side="right" delay={0.15 * i} />
        ))}
      </div>
    </div>
  );
};
