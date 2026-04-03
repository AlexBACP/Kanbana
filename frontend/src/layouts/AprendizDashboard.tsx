/**
 * AprendizDashboard — Dedicated layout for the "aprendiz" role.
 * Lives at /kanban. Completely independent from AdminDashboard.
 * No Sidebar prop crash because it uses its own simplified nav.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth.store';
import { useAuth } from '../hooks/useAuth';
import { TopBar } from '../components/TopBar';
import { SettingsPanel } from '../dashboard/panels/SettingsPanel';
import { ProfilePage } from '../pages/ProfilePage';
import { NotificationsPanel } from '../dashboard/panels/NotificationsPanel';
import { KanbanBoard } from '../components/KanbanBoard';
import { ticketService } from '../services/ticket.service';
import { projectService } from '../services/project.service';
import { LayoutGrid, ClipboardList, Bell, CheckCircle2, Clock, AlertCircle, Ticket, ExternalLink } from 'lucide-react';
import { TicketStatus } from '../types/ticket.types';

type Sec = 'tablero' | 'tickets' | 'notificaciones' | 'settings' | 'profile';

const TITLES: Record<Sec, string> = {
  tablero:       'Mi Tablero Kanban',
  tickets:       'Mis Tickets',
  notificaciones:'Notificaciones',
  settings:      'Configuración',
  profile:       'Mi Perfil',
};

const STATUS_LABEL: Record<string, string> = {
  to_do:       'Por hacer',
  in_progress: 'En progreso',
  testing:     'Testing',
  done:        'Completado',
};

const STATUS_COLOR: Record<string, string> = {
  to_do:       'bg-slate-500/10 text-slate-400 border-slate-500/20',
  in_progress: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  testing:     'bg-amber-500/10 text-amber-400 border-amber-500/20',
  done:        'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

const PRIO_DOT: Record<string, string> = { alta:'bg-rose-500', media:'bg-amber-500', baja:'bg-slate-500' };

// ── Mi Tablero ────────────────────────────────────────────────────────────────
const MiTablero = () => {
  const { user } = useAuthStore();
  const qc = useQueryClient();

  // Get all tickets and filter client-side for this user
  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['tickets', 'mis'],
    queryFn: () => ticketService.getAll(),
    staleTime: 30_000,
    select: (t) => t.filter(tk => tk.asignado_a === user?.id || (tk as any).asignado_a_id === user?.id),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, estado }: { id: number; estado: TicketStatus }) =>
      ticketService.updateStatus(id, { estado }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets', 'mis'] }),
  });

  const t = tickets as any[];
  const done = t.filter(x=>x.estado==='done').length;
  const inProgress = t.filter(x=>x.estado==='in_progress').length;
  const pending = t.filter(x=>x.estado==='to_do').length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: CheckCircle2, label:'Completados',  value:done,       color:'emerald' },
          { icon: Clock,        label:'En progreso',  value:inProgress, color:'blue' },
          { icon: AlertCircle,  label:'Pendientes',   value:pending,    color:'amber' },
          { icon: Ticket,       label:'Total',        value:t.length,   color:'violet' },
        ].map(({ icon:Icon, label, value, color }) => (
          <div key={label} className="bg-dark-card border border-dark-border rounded-2xl p-4 flex items-center gap-3">
            <div className={`p-2.5 rounded-xl bg-${color}-500/10`}><Icon size={16} className={`text-${color}-400`} /></div>
            <div>
              <p className="text-xl font-black text-dark-text">{value}</p>
              <p className="text-[10px] text-dark-muted uppercase tracking-wider">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="h-40 bg-dark-card/50 rounded-2xl animate-pulse border border-dark-border" />
      ) : t.length === 0 ? (
        <div className="text-center py-20 bg-dark-card/20 rounded-[2.5rem] border border-dashed border-dark-border">
          <LayoutGrid size={36} className="mx-auto text-dark-muted mb-3 opacity-30" />
          <p className="text-dark-muted font-black uppercase tracking-widest text-sm">Sin tareas asignadas aún</p>
          <p className="text-xs text-dark-muted/60 mt-2">Tu líder técnico te asignará tickets cuando comience el sprint</p>
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <KanbanBoard
            tickets={t}
            onStatusChange={(ticketId, newStatus) =>
              updateStatusMutation.mutate({ id: ticketId, estado: newStatus })
            }
          />
        </div>
      )}
    </div>
  );
};

// ── Mis Tickets ───────────────────────────────────────────────────────────────
const MisTickets = () => {
  const { user } = useAuthStore();
  const [filter, setFilter] = useState<string>('all');

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['tickets', 'mis-lista'],
    queryFn: () => ticketService.getAll(),
    staleTime: 30_000,
    select: (t) => t.filter(tk => tk.asignado_a === user?.id || (tk as any).asignado_a_id === user?.id),
  });

  const t = tickets as any[];
  const filtered = filter === 'all' ? t : t.filter(x=>x.estado===filter);

  return (
    <div className="space-y-5">
      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {['all','to_do','in_progress','testing','done'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
              filter===s ? 'bg-primary-600/15 text-primary-400 border-primary-500/25' : 'bg-dark-card text-dark-muted border-dark-border hover:text-dark-text'
            }`}
          >
            {s==='all' ? `Todos (${t.length})` : `${STATUS_LABEL[s]} (${t.filter(x=>x.estado===s).length})`}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="h-32 bg-dark-card/50 rounded-2xl animate-pulse border border-dark-border" />
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-dark-card/20 rounded-[2rem] border border-dashed border-dark-border">
          <ClipboardList size={28} className="mx-auto text-dark-muted mb-3 opacity-30" />
          <p className="text-dark-muted font-black uppercase tracking-widest text-sm">Sin tickets en esta categoría</p>
        </div>
      ) : (
        <div className="bg-dark-card border border-dark-border rounded-[2rem] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-border">
                {['ID','Título','Estado','Prioridad','Vence'].map(h=>(
                  <th key={h} className="text-left px-5 py-3.5 text-[10px] font-black text-dark-muted uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((tk: any) => {
                const daysLeft = tk.fecha_limite
                  ? Math.ceil((new Date(tk.fecha_limite).getTime() - Date.now()) / 86400000) : null;
                return (
                  <tr key={tk.id} className="border-b border-dark-border/50 last:border-0 hover:bg-dark-bg/40 cursor-pointer"
                    onClick={() => window.open(`/tickets/${tk.id}`, '_self')}
                  >
                    <td className="px-5 py-3.5 text-xs font-black text-primary-400">#{tk.id}</td>
                    <td className="px-5 py-3.5 text-sm font-bold text-dark-text max-w-xs truncate">{tk.titulo}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border uppercase tracking-widest ${STATUS_COLOR[tk.estado] || ''}`}>
                        {STATUS_LABEL[tk.estado] || tk.estado}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className={`w-2 h-2 rounded-full inline-block ${PRIO_DOT[tk.prioridad] || 'bg-slate-500'}`} />
                      <span className="ml-2 text-xs text-dark-muted capitalize">{tk.prioridad}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      {daysLeft === null ? <span className="text-xs text-dark-muted">—</span> : (
                        <span className={`text-xs font-bold ${daysLeft<0?'text-rose-400':daysLeft<=2?'text-amber-400':'text-dark-muted'}`}>
                          {daysLeft<0?'Vencido':daysLeft===0?'Hoy':`${daysLeft}d`}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ── Layout ────────────────────────────────────────────────────────────────────
export const AprendizDashboard = () => {
  const [sec, setSec] = useState<Sec>('tablero');
  const { user, settings } = useAuthStore();
  const { logout } = useAuth();
  const grad = ({
    violet:'from-violet-600 to-indigo-700', blue:'from-blue-600 to-cyan-700',
    emerald:'from-emerald-600 to-teal-700', rose:'from-rose-600 to-pink-700',
    amber:'from-amber-500 to-orange-600', cyan:'from-cyan-600 to-blue-700',
  })[settings.themeColor] ?? 'from-violet-600 to-indigo-700';

  const avatar = user?.avatar_url
    ? <img src={user.avatar_url} className="w-full h-full object-cover" alt="" />
    : <span className="text-sm font-black text-white">{user?.nombre?.slice(0,2).toUpperCase()}</span>;

  const nav = [
    { label:'Mi Tablero', key:'tablero'       as Sec, icon:LayoutGrid },
    { label:'Mis Tickets',key:'tickets'       as Sec, icon:ClipboardList },
    { label:'Notificaciones',key:'notificaciones' as Sec, icon:Bell },
  ];

  const panel = { initial:{opacity:0,y:10}, animate:{opacity:1,y:0}, exit:{opacity:0,y:-8} };

  return (
    <div className="flex h-screen bg-dark-bg overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-dark-card border-r border-dark-border flex flex-col h-full shadow-2xl shrink-0">
        <div className="px-6 py-7 border-b border-dark-border">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 bg-gradient-to-br ${grad} rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg`}>K</div>
            <div>
              <h1 className="text-lg font-black text-dark-text leading-none">Kanbana</h1>
              <p className="text-[10px] text-dark-muted mt-1 uppercase tracking-widest font-black opacity-60 italic">SENA · ADSO</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-5 space-y-1">
          <p className="px-4 text-[9px] font-black text-dark-muted/40 uppercase tracking-[0.25em] mb-3">Mi Espacio</p>
          {nav.map(({label,key,icon:Icon}) => {
            const active = sec===key;
            return (
              <button key={key} onClick={()=>setSec(key)}
                className={`relative flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-bold w-full text-left transition-all border ${
                  active ? 'bg-primary-600/15 text-primary-400 border-primary-500/25' : 'text-dark-muted hover:text-dark-text hover:bg-dark-bg/40 border-transparent'
                }`}
              >
                {active && <motion.div layoutId="aprendiz-nav" className="absolute inset-0 bg-primary-600/10 rounded-2xl" transition={{type:'spring',bounce:0.15,duration:0.4}} />}
                <Icon size={17} className={`relative z-10 ${active?'text-primary-400':'text-dark-muted/70'}`} />
                <span className="relative z-10">{label}</span>
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-dark-border space-y-2">
          <button onClick={()=>setSec('profile')}
            className="flex items-center gap-3 w-full px-3 py-3 rounded-2xl bg-dark-bg/40 border border-dark-border hover:bg-dark-bg/70 transition-all group"
          >
            <div className={`h-9 w-9 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center overflow-hidden border border-white/10 shrink-0`}>{avatar}</div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-black text-dark-text truncate group-hover:text-primary-400 transition-colors">{user?.nombre}</p>
              <p className="text-[10px] text-dark-muted font-bold">Aprendiz</p>
            </div>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          title={TITLES[sec]}
          user={user}
          onNotifications={() => setSec('notificaciones')}
          onProfile={() => setSec('profile')}
          onSettings={() => setSec('settings')}
          onLogout={logout}
        />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div key={sec} variants={panel} initial="initial" animate="animate" exit="exit" transition={{duration:0.18}}>
              {sec === 'tablero'        && <MiTablero />}
              {sec === 'tickets'        && <MisTickets />}
              {sec === 'notificaciones' && <NotificationsPanel />}
              {sec === 'settings'       && <SettingsPanel />}
              {sec === 'profile'        && <ProfilePage />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};
