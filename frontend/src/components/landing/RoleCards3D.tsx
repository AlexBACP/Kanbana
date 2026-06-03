/**
 * RoleCards3D — Tarjetas de roles con efecto tilt 3D que sigue el cursor.
 *
 * Cada rol tiene identidad propia (color, gradiente e ícono) — ya no la misma
 * foto repetida. Al mover el mouse, la tarjeta se inclina en 3D y un brillo
 * (glare) sigue el puntero. Aparecen con stagger al hacer scroll.
 */
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { Crown, GraduationCap, GitBranch, Code2 } from 'lucide-react';
import type { ComponentType } from 'react';

interface Role {
  label: string;
  desc: string;
  icon: ComponentType<{ size?: number | string; className?: string }>;
  tag: string;
  grad: string;   // gradiente del halo/ícono
  ring: string;   // color del borde al hacer hover
  text: string;   // color de acento
}

const ROLES: Role[] = [
  {
    label: 'Coordinador', tag: 'Acceso total',
    desc: 'Gestiona fichas, usuarios y todos los proyectos del programa ADSO.',
    icon: Crown, grad: 'from-amber-500/30 to-amber-700/5',
    ring: 'group-hover:border-amber-400/50', text: 'text-amber-300',
  },
  {
    label: 'Instructor', tag: 'Supervisión',
    desc: 'Supervisa los proyectos de sus fichas asignadas y aprueba módulos.',
    icon: GraduationCap, grad: 'from-blue-500/30 to-blue-700/5',
    ring: 'group-hover:border-blue-400/50', text: 'text-blue-300',
  },
  {
    label: 'Líder técnico', tag: 'Sub-rol',
    desc: 'Dirige el equipo de desarrollo, gestiona el backlog y los sprints.',
    icon: GitBranch, grad: 'from-violet-500/30 to-violet-700/5',
    ring: 'group-hover:border-violet-400/50', text: 'text-violet-300',
  },
  {
    label: 'Aprendiz', tag: 'Ejecución',
    desc: 'Trabaja sus tareas asignadas desde el tablero Kanban personal.',
    icon: Code2, grad: 'from-emerald-500/30 to-emerald-700/5',
    ring: 'group-hover:border-emerald-400/50', text: 'text-emerald-300',
  },
];

const TiltCard = ({ role, index }: { role: Role; index: number }) => {
  const Icon = role.icon;

  // Posición del puntero normalizada (-0.5 a 0.5)
  const px = useMotionValue(0);
  const py = useMotionValue(0);

  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], ['9deg', '-9deg']), { stiffness: 200, damping: 18 });
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], ['-9deg', '9deg']), { stiffness: 200, damping: 18 });

  // Posición del brillo (glare) en %
  const glareX = useTransform(px, [-0.5, 0.5], ['0%', '100%']);
  const glareY = useTransform(py, [-0.5, 0.5], ['0%', '100%']);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  };
  const onLeave = () => { px.set(0); py.set(0); };

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: [0.4, 0, 0.2, 1] }}
      style={{ perspective: 1000 }}
    >
      <motion.div
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        className={`group relative h-[230px] overflow-hidden rounded-2xl border border-zinc-700/60 bg-zinc-950 p-6 shadow-xl transition-colors ${role.ring}`}
      >
        {/* Halo de color del rol */}
        <div className={`pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br ${role.grad} blur-2xl`} />

        {/* Glare que sigue el cursor */}
        <motion.div
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background: 'radial-gradient(circle at var(--gx) var(--gy), rgba(255,255,255,0.14), transparent 45%)',
            // @ts-expect-error CSS custom props
            '--gx': glareX, '--gy': glareY,
          }}
        />

        {/* Contenido (elevado en 3D) */}
        <div style={{ transform: 'translateZ(40px)' }} className="relative flex h-full flex-col">
          <div className="mb-4 flex items-center justify-between">
            <div className={`grid h-12 w-12 place-items-center rounded-xl border border-white/10 bg-gradient-to-br ${role.grad} ${role.text}`}>
              <Icon size={22} />
            </div>
            <span className={`rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${role.text}`}>
              {role.tag}
            </span>
          </div>

          <h3 className="text-[18px] font-extrabold tracking-tight text-white">{role.label}</h3>
          <p className="mt-2 text-[12px] leading-relaxed text-zinc-400">{role.desc}</p>

          <div className={`mt-auto flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ${role.text}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            Rol del sistema
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export const RoleCards3D = () => (
  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
    {ROLES.map((r, i) => <TiltCard key={r.label} role={r} index={i} />)}
  </div>
);
