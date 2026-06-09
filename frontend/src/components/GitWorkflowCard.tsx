/**
 * GitWorkflowCard — Guía contextual de Git para una tarea.
 *
 * Estrategia: UNA RAMA POR SPRINT (módulo). Todas las tareas del mismo
 * sprint se trabajan en la misma rama; cada commit referencia su propia
 * tarea con KAN-XXXXX y mueve solo esa tarea en el tablero. Al final del
 * sprint, un solo Pull Request mergea todo el módulo.
 *
 * Si no hay sprint asociado, cae al modo "rama por tarea".
 */
import { useState } from 'react';
import {
  GitBranch, GitCommit, GitPullRequest,
  Copy, Check, ArrowRight, Sparkles, ChevronDown, ChevronUp,
  Users, Info,
} from 'lucide-react';

interface GitWorkflowCardProps {
  codigoReferencia: number | null | undefined;
  titulo:            string;
  sprintNombre?:     string | null;
  ticketNumber?:     number | null;
}

// ── Slug helpers ───────────────────────────────────────────────────────────
function toSlug(s: string, maxLen = 40): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, maxLen)
    .replace(/-$/, '');
}

export const GitWorkflowCard = ({
  codigoReferencia, titulo, sprintNombre, ticketNumber,
}: GitWorkflowCardProps) => {
  const [open,   setOpen]   = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  if (!codigoReferencia) return null;

  const kanCode      = `KAN-${codigoReferencia}`;
  const tituloSlug   = toSlug(titulo || 'tarea');
  const sprintSlug   = sprintNombre ? toSlug(sprintNombre, 30) : null;
  const branchSprint = sprintSlug ? `sprint/${sprintSlug}` : null;

  // Comandos generados
  const cmdCheckout    = branchSprint
    ? `git checkout -b ${branchSprint}    # primera vez en este sprint`
    : `git checkout -b ${kanCode}-${tituloSlug}`;
  const cmdPullExist   = branchSprint
    ? `git checkout ${branchSprint} && git pull`
    : null;
  const cmdCommit      = `git commit -m "${kanCode}: describe aquí tu cambio"`;
  const cmdPush        = branchSprint
    ? `git push origin ${branchSprint}`
    : `git push origin ${kanCode}-${tituloSlug}`;
  const prTitle        = branchSprint
    ? `Sprint ${sprintNombre} — incluye ${kanCode}${ticketNumber ? ` (#${ticketNumber})` : ''}`
    : `${kanCode} ${titulo}`;

  const copy = (id: string, text: string) => {
    // Limpiar comentario en línea (después de "    #") al copiar
    const clean = text.replace(/\s+#.*$/, '');
    navigator.clipboard.writeText(clean);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-950/30 via-zinc-900/40 to-violet-950/20 overflow-hidden">

      {/* ── Header colapsable ─────────────────────────────────────────────── */}
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
              {branchSprint
                ? <>Convención del equipo: <span className="text-blue-300 font-bold">una rama por sprint</span> · todos colaboran en la misma</>
                : 'Comandos listos para copiar — todo se sincroniza automáticamente'}
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

          {/* Banner que explica la convención cuando hay sprint */}
          {branchSprint && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-violet-500/8 border border-violet-500/20">
              <Users size={13} className="text-violet-300 mt-0.5 shrink-0" />
              <div className="text-[10.5px] text-zinc-300 leading-relaxed">
                Todos los aprendices del equipo trabajan en la rama{' '}
                <code className="px-1 py-0.5 rounded bg-zinc-800 text-violet-300 font-mono">{branchSprint}</code>.
                Cada commit lleva su propio <code className="px-1 py-0.5 rounded bg-zinc-800 text-blue-300 font-mono">KAN-XXXXX</code>{' '}
                y mueve solo esa tarea en el tablero.
              </div>
            </div>
          )}

          {/* 1. Cambiarse a la rama */}
          <Step
            n="1"
            icon={<GitBranch size={11} />}
            label={branchSprint ? 'Cámbiate a la rama del sprint' : 'Crea tu rama'}
            cmds={cmdPullExist
              ? [
                  { id: 'br-new',  text: cmdCheckout,  hint: 'Primera vez en este sprint' },
                  { id: 'br-pull', text: cmdPullExist, hint: 'La rama ya existe — únete y trae cambios' },
                ]
              : [{ id: 'br-new', text: cmdCheckout }]
            }
            copied={copied}
            onCopy={copy}
          />

          {/* 2. Commit */}
          <Step
            n="2"
            icon={<GitCommit size={11} />}
            label="Haz tu commit con la referencia"
            cmds={[{ id: 'commit', text: cmdCommit }]}
            copied={copied}
            onCopy={copy}
          />

          {/* 3. Push */}
          <Step
            n="3"
            icon={<GitBranch size={11} />}
            label="Sube los cambios"
            cmds={[{ id: 'push', text: cmdPush }]}
            copied={copied}
            onCopy={copy}
          />

          {/* 4. PR (al cierre del sprint) */}
          <Step
            n="4"
            icon={<GitPullRequest size={11} />}
            label={branchSprint
              ? 'Cuando el sprint termine, el líder crea el PR'
              : 'Crea el Pull Request con este título'
            }
            cmds={[{ id: 'pr', text: prTitle, hint: 'Título sugerido del PR' }]}
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
              <FlowLine icon={<GitCommit size={10} />}     from="Tu commit con KAN-XXXXX" to="En desarrollo" color="text-blue-400" />
              <FlowLine icon={<GitPullRequest size={10} />} from="PR del sprint abierto"   to="En revisión"   color="text-amber-400" />
              <FlowLine icon={<GitPullRequest size={10} />} from="PR del sprint mergeado"  to="Finalizada"    color="text-emerald-400" />
            </div>
          </div>

          {/* ── Tips ──────────────────────────────────────────────────────── */}
          <div className="mt-2 space-y-1.5 pt-2">
            <Tip>
              <span className="text-zinc-400 font-bold">Antes de pushear:</span> haz{' '}
              <code className="px-1 py-0.5 rounded bg-zinc-800 text-emerald-300 font-mono">git pull</code>{' '}
              para evitar conflictos con commits de tus compañeros.
            </Tip>
            <Tip>
              <span className="text-zinc-400 font-bold">Importante:</span>{' '}
              <code className="px-1 py-0.5 rounded bg-zinc-800 text-blue-300 font-mono">{kanCode}</code> debe ir
              al inicio del mensaje del commit y separado por <code className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">:</code> o espacio.
              Si lo pegas a otra palabra (ej. <code className="px-1 py-0.5 rounded bg-zinc-800 text-rose-300 font-mono">arregla{kanCode}</code>) Kanbana no lo detecta.
            </Tip>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Step: bloque con label + uno o varios comandos ─────────────────────────
interface CmdLine { id: string; text: string; hint?: string; }
interface StepProps {
  n:      string;
  icon:   React.ReactNode;
  label:  string;
  cmds:   CmdLine[];
  copied: string | null;
  onCopy: (id: string, text: string) => void;
}
const Step = ({ n, icon, label, cmds, copied, onCopy }: StepProps) => (
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
    <div className="space-y-1.5">
      {cmds.map(c => (
        <CmdBlock key={c.id} cmd={c} copied={copied} onCopy={onCopy} />
      ))}
    </div>
  </div>
);

const CmdBlock = ({ cmd, copied, onCopy }: { cmd: CmdLine; copied: string | null; onCopy: (id: string, text: string) => void }) => {
  const isCopied = copied === cmd.id;
  // Separar comentario para colorearlo aparte
  const match    = cmd.text.match(/^(.*?)(\s+#.*)?$/);
  const command  = match?.[1] ?? cmd.text;
  const comment  = match?.[2] ?? '';
  return (
    <div className="relative group">
      <pre className="bg-zinc-950/70 border border-zinc-800 rounded-lg px-3 py-2 pr-10 text-[11px] font-mono overflow-x-auto leading-relaxed">
        <span className="text-emerald-300">{command}</span>
        {comment && <span className="text-zinc-500">{comment}</span>}
      </pre>
      <button
        onClick={() => onCopy(cmd.id, cmd.text)}
        title="Copiar"
        className={`absolute right-1.5 top-1.5 p-1.5 rounded-md transition-all ${
          isCopied
            ? 'bg-emerald-500/20 text-emerald-300'
            : 'bg-zinc-800/80 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700'
        }`}
      >
        {isCopied ? <Check size={12} /> : <Copy size={12} />}
      </button>
      {cmd.hint && (
        <p className="mt-1 ml-1 text-[9.5px] text-zinc-500 italic">→ {cmd.hint}</p>
      )}
    </div>
  );
};

const FlowLine = ({ icon, from, to, color }: { icon: React.ReactNode; from: string; to: string; color: string }) => (
  <div className="flex items-center gap-2 text-[10.5px]">
    <span className={`${color} flex items-center gap-1`}>{icon}<span className="text-zinc-400">{from}</span></span>
    <ArrowRight size={10} className="text-zinc-600" />
    <span className={`${color} font-bold`}>{to}</span>
  </div>
);

const Tip = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] text-zinc-500 leading-relaxed flex items-start gap-1.5">
    <Info size={9} className="text-zinc-600 mt-0.5 shrink-0" />
    <span>{children}</span>
  </p>
);
