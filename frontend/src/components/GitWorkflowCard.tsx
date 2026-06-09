/**
 * GitWorkflowCard — Guía contextual de Git para una tarea.
 *
 * Muestra al aprendiz / líder técnico los comandos exactos para vincular
 * su trabajo de GitHub con esta tarea, con el código KAN-XXXXX ya inyectado
 * y un slug del título generado automáticamente. Cada bloque tiene botón
 * "copiar" individual.
 *
 * Se inserta en la tab "GitHub" del TicketDetailPage.
 */
import { useState } from 'react';
import {
  GitBranch, GitCommit, GitPullRequest,
  Copy, Check, ArrowRight, Sparkles, ChevronDown, ChevronUp,
} from 'lucide-react';

interface GitWorkflowCardProps {
  codigoReferencia: number | null | undefined;
  titulo:            string;
}

// ── Convierte un título humano a slug para nombre de rama ──────────────────
// "Login con JWT y refresh tokens" → "login-con-jwt-y-refresh-tokens"
// Quita tildes, caracteres especiales, baja todo, corta a ~40 chars.
function tituloASlug(titulo: string): string {
  return titulo
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // quita tildes
    .replace(/[^a-z0-9\s-]/g, '')                       // solo letras/números/espacios/guiones
    .trim()
    .replace(/\s+/g, '-')                               // espacios → guiones
    .replace(/-+/g, '-')                                // múltiples guiones → uno
    .slice(0, 40)
    .replace(/-$/, '');                                 // sin guión al final
}

export const GitWorkflowCard = ({ codigoReferencia, titulo }: GitWorkflowCardProps) => {
  const [open,   setOpen]   = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  if (!codigoReferencia) return null;

  const kanCode  = `KAN-${codigoReferencia}`;
  const slug     = tituloASlug(titulo || 'tarea');
  const branch   = `${kanCode}-${slug}`;
  const cmdBranch = `git checkout -b ${branch}`;
  const cmdCommit = `git commit -m "${kanCode}: describe aquí tu cambio"`;
  const prTitle   = `${kanCode} ${titulo}`;

  const copy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-950/30 via-zinc-900/40 to-violet-950/20 overflow-hidden">

      {/* ── Header (clickable para colapsar) ─────────────────────────────── */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
            <Sparkles size={14} className="text-blue-300" />
          </div>
          <div>
            <h4 className="text-[12px] font-black text-zinc-100 tracking-wide">
              Cómo trabajar esta tarea en GitHub
            </h4>
            <p className="text-[10px] text-zinc-500">
              Comandos listos para copiar — todo se sincroniza automáticamente
            </p>
          </div>
        </div>
        {open
          ? <ChevronUp size={16} className="text-zinc-500" />
          : <ChevronDown size={16} className="text-zinc-500" />}
      </button>

      {/* ── Contenido ─────────────────────────────────────────────────────── */}
      {open && (
        <div className="px-4 pb-4 space-y-3">

          {/* 1. Crear rama */}
          <Step
            n="1"
            icon={<GitBranch size={11} />}
            label="Crea tu rama"
            cmd={cmdBranch}
            id="branch"
            copied={copied}
            onCopy={copy}
          />

          {/* 2. Hacer commit */}
          <Step
            n="2"
            icon={<GitCommit size={11} />}
            label="Haz commits con la referencia"
            cmd={cmdCommit}
            id="commit"
            copied={copied}
            onCopy={copy}
          />

          {/* 3. Crear PR */}
          <Step
            n="3"
            icon={<GitPullRequest size={11} />}
            label="Crea el Pull Request con este título"
            cmd={prTitle}
            id="pr"
            copied={copied}
            onCopy={copy}
          />

          {/* ── Flow automático ───────────────────────────────────────────── */}
          <div className="mt-4 pt-4 border-t border-zinc-700/50">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2.5 flex items-center gap-1.5">
              <Sparkles size={10} className="text-blue-400" />
              Kanbana mueve la tarea automáticamente
            </p>
            <div className="space-y-1.5">
              <FlowLine icon={<GitCommit size={10} />} from="Push de un commit"  to="En desarrollo" color="text-blue-400" />
              <FlowLine icon={<GitPullRequest size={10} />} from="PR abierto"    to="En revisión"   color="text-amber-400" />
              <FlowLine icon={<GitPullRequest size={10} />} from="PR mergeado"   to="Finalizada"    color="text-emerald-400" />
            </div>
          </div>

          {/* ── Tip pequeño ───────────────────────────────────────────────── */}
          <p className="text-[10px] text-zinc-500 leading-relaxed pt-1">
            <span className="text-zinc-400 font-bold">Tip:</span>{' '}
            Para que Kanbana detecte tu trabajo, <code className="px-1 py-0.5 rounded bg-zinc-800 text-blue-300 font-mono">{kanCode}</code> debe
            aparecer aislado por guiones, espacios o dos puntos. No funciona si lo pegas a otra palabra
            (ej. <code className="px-1 py-0.5 rounded bg-zinc-800 text-rose-300 font-mono">feature{kanCode}</code> ❌).
          </p>
        </div>
      )}
    </div>
  );
};

// ── Sub-componente: cada paso con su comando + botón copiar ────────────────
interface StepProps {
  n:      string;
  icon:   React.ReactNode;
  label:  string;
  cmd:    string;
  id:     string;
  copied: string | null;
  onCopy: (id: string, text: string) => void;
}
const Step = ({ n, icon, label, cmd, id, copied, onCopy }: StepProps) => {
  const isCopied = copied === id;
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="w-4 h-4 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-[9px] font-black text-blue-300">
          {n}
        </span>
        <span className="text-[10px] font-bold text-zinc-300 flex items-center gap-1.5">
          <span className="text-blue-400">{icon}</span>
          {label}
        </span>
      </div>
      <div className="relative group">
        <pre className="bg-zinc-950/70 border border-zinc-800 rounded-lg px-3 py-2 pr-10 text-[11px] text-emerald-300 font-mono overflow-x-auto leading-relaxed">
          {cmd}
        </pre>
        <button
          onClick={() => onCopy(id, cmd)}
          title="Copiar"
          className={`absolute right-1.5 top-1.5 p-1.5 rounded-md transition-all ${
            isCopied
              ? 'bg-emerald-500/20 text-emerald-300'
              : 'bg-zinc-800/80 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700'
          }`}
        >
          {isCopied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      </div>
    </div>
  );
};

// ── Sub-componente: línea del flow ─────────────────────────────────────────
interface FlowLineProps { icon: React.ReactNode; from: string; to: string; color: string; }
const FlowLine = ({ icon, from, to, color }: FlowLineProps) => (
  <div className="flex items-center gap-2 text-[10.5px]">
    <span className={`${color} flex items-center gap-1`}>{icon}<span className="text-zinc-400">{from}</span></span>
    <ArrowRight size={10} className="text-zinc-600" />
    <span className={`${color} font-bold`}>{to}</span>
  </div>
);
