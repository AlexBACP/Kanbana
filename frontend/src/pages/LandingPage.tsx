/**
 * LandingPage — ruta pública "/"
 *
 * El botón "Iniciar sesión" abre /login en un popup.
 * Al autenticarse, el popup envía postMessage → la landing recarga el estado
 * y redirige al dashboard del rol correspondiente.
 *
 * FIX: Tras recibir LOGIN_SUCCESS, llamamos authService.me() para hidratar
 * el store del padre (no solo confiar en localStorage que no dispara Zustand).
 */
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { authService } from '../services/auth.service';
import {
  LayoutGrid, Users, FileText, ShieldCheck,
  Kanban, Bell, BarChart2, ArrowRight,
  CheckCircle2, Zap, Lock,
} from 'lucide-react';

export const LandingPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const popupRef = useRef<Window | null>(null);

  // Si ya hay sesión activa al cargar, redirigir
  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      navigate(user.rol === 'aprendiz' ? '/kanban' : '/dashboard', { replace: true });
    }
  }, [isAuthenticated, isLoading, user, navigate]);

  // Escuchar postMessage del popup
  useEffect(() => {
    const handler = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'LOGIN_SUCCESS') return;

      // Cerrar popup si sigue abierto
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }

      // FIX CLAVE: el token ya está en localStorage (lo guardó el popup),
      // pero el store de ESTA ventana todavía tiene user=null.
      // Llamamos me() para hidratar el store correctamente.
      try {
        const { setUser } = useAuthStore.getState();
        const user = await authService.me();
        setUser(user);
        const dest = user.rol === 'aprendiz' ? '/kanban' : '/dashboard';
        navigate(dest, { replace: true });
      } catch {
        // Si falla, limpiar y dejar al usuario en landing
        const { clearUser } = useAuthStore.getState();
        clearUser();
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [navigate]);

  const openLoginPopup = () => {
    const w = 460, h = 580;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    const popup = window.open(
      '/login',
      'kanbana_login',
      `width=${w},height=${h},left=${left},top=${top},resizable=no,scrollbars=no,toolbar=no,menubar=no`
    );
    popupRef.current = popup;

    // Polling de respaldo: si el popup se cierra sin postMessage
    const timer = setInterval(async () => {
      if (popup && popup.closed) {
        clearInterval(timer);
        const token = localStorage.getItem('access_token');
        if (token) {
          try {
            const { setUser, isAuthenticated } = useAuthStore.getState();
            if (!isAuthenticated) {
              const user = await authService.me();
              setUser(user);
              navigate(user.rol === 'aprendiz' ? '/kanban' : '/dashboard', { replace: true });
            }
          } catch { /* token inválido, quedarse en landing */ }
        }
      }
    }, 500);
  };

  const features = [
    { icon: Kanban, title: 'Tablero Kanban', desc: 'Visualiza el progreso de cada proyecto con columnas por estado. Arrastra y suelta tickets entre etapas.' },
    { icon: Users, title: 'Gestión de equipos', desc: 'Coordinadores, instructores, líderes y aprendices con roles diferenciados y permisos específicos.' },
    { icon: FileText, title: 'Fichas de formación', desc: 'Organiza los proyectos ADSO por ficha de formación. Cada grupo tiene sus propios proyectos y sprints.' },
    { icon: BarChart2, title: 'Métricas y seguimiento', desc: 'Velocidad por sprint, burnup de proyecto y estadísticas de avance en tiempo real.' },
    { icon: Bell, title: 'Notificaciones', desc: 'Alertas automáticas de cambios de estado, asignaciones y actualizaciones del proyecto.' },
    { icon: ShieldCheck, title: 'Control de acceso', desc: 'Cada rol ve solo lo que necesita. Seguridad basada en JWT con tokens de acceso y refresco.' },
  ];

  const roles = [
    { label: 'Coordinador', desc: 'Gestiona fichas, usuarios y todos los proyectos del programa.', color: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
    { label: 'Instructor', desc: 'Supervisa los proyectos de sus fichas asignadas y aprendices.', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    { label: 'Líder técnico', desc: 'Dirige el equipo de desarrollo, gestiona backlog y sprints.', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    { label: 'Aprendiz', desc: 'Trabaja sus tickets asignados desde el tablero Kanban personal.', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  ];

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3]">

      {/* ── Navbar ─────────────────────────────────────────────── */}
      <nav className="border-b border-[#21262d] sticky top-0 z-50 bg-[#0d1117]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-sm font-bold text-white">K</span>
            </div>
            <span className="font-semibold text-[#e6edf3]">Kanbana</span>
            <span className="text-[10px] text-[#8b949e] border border-[#30363d] rounded px-1.5 py-0.5 ml-1">
              SENA · ADSO
            </span>
          </div>
          <button
            onClick={openLoginPopup}
            className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Iniciar sesión
            <ArrowRight size={14} />
          </button>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-xs font-medium mb-8">
          <Zap size={11} />
          Sistema de gestión para proyectos formativos
        </div>

        <h1 className="text-4xl md:text-5xl font-semibold text-[#e6edf3] leading-tight mb-5">
          Gestiona tus proyectos ADSO<br />
          <span className="text-indigo-400">con claridad y estructura</span>
        </h1>

        <p className="text-lg text-[#8b949e] max-w-2xl mx-auto mb-10">
          Kanbana organiza fichas, proyectos, sprints y tickets en un solo lugar.
          Diseñado para el flujo de trabajo del SENA — de la ficha de formación al código.
        </p>

        <div className="flex items-center justify-center gap-4 flex-wrap">
          <button
            onClick={openLoginPopup}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-colors text-sm"
          >
            Acceder al sistema
            <ArrowRight size={15} />
          </button>
          <a
            href="#features"
            className="flex items-center gap-2 px-6 py-3 border border-[#30363d] hover:border-[#484f58] text-[#8b949e] hover:text-[#e6edf3] font-medium rounded-xl transition-colors text-sm"
          >
            Ver funcionalidades
          </a>
        </div>

        {/* Preview mockup */}
        <div className="mt-16 relative">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl overflow-hidden shadow-2xl max-w-4xl mx-auto">
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-[#21262d]">
              <span className="w-3 h-3 rounded-full bg-[#f85149]/60" />
              <span className="w-3 h-3 rounded-full bg-[#d29922]/60" />
              <span className="w-3 h-3 rounded-full bg-[#3fb950]/60" />
              <span className="ml-4 text-xs text-[#8b949e]">Kanbana — Panel de control</span>
            </div>
            <div className="flex h-56">
              <div className="w-40 border-r border-[#21262d] p-3 space-y-1.5 shrink-0">
                {['Panel de control', 'Proyectos', 'Fichas SENA', 'Usuarios', 'Líderes'].map((item, i) => (
                  <div key={item} className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs ${i === 0 ? 'bg-indigo-500/10 text-indigo-400' : 'text-[#8b949e]'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-indigo-400' : 'bg-[#30363d]'}`} />
                    {item}
                  </div>
                ))}
              </div>
              <div className="flex-1 p-4 space-y-3">
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Proyectos activos', val: '8', color: 'text-[#79c0ff]' },
                    { label: 'Tickets abiertos', val: '24', color: 'text-[#d29922]' },
                    { label: 'En testing', val: '6', color: 'text-violet-400' },
                    { label: 'Completados', val: '47', color: 'text-[#3fb950]' },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="bg-[#0d1117] border border-[#21262d] rounded-lg p-2.5">
                      <p className={`text-lg font-semibold ${color}`}>{val}</p>
                      <p className="text-[9px] text-[#8b949e] mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-3 space-y-1.5">
                  {[
                    { name: 'Sistema de inventarios ADSO', estado: 'Activo', color: 'text-[#3fb950]' },
                    { name: 'App de gestión académica', estado: 'En pausa', color: 'text-[#d29922]' },
                    { name: 'Portal de aprendices SENA', estado: 'Activo', color: 'text-[#3fb950]' },
                  ].map(({ name, estado, color }) => (
                    <div key={name} className="flex items-center justify-between">
                      <span className="text-xs text-[#e6edf3]">{name}</span>
                      <span className={`text-[10px] font-medium ${color}`}>{estado}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="absolute inset-0 -z-10 bg-indigo-600/5 blur-3xl rounded-3xl" />
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────── */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-16 border-t border-[#21262d]">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-semibold text-[#e6edf3] mb-3">
            Todo lo que necesita un proyecto formativo
          </h2>
          <p className="text-[#8b949e] max-w-xl mx-auto text-sm">
            Construido sobre el flujo real del SENA: ficha → proyecto → sprint → ticket → evidencia.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-[#161b22] border border-[#21262d] rounded-xl p-5 hover:border-[#30363d] transition-colors">
              <div className="w-8 h-8 bg-indigo-500/10 border border-indigo-500/20 rounded-lg flex items-center justify-center mb-4">
                <Icon size={15} className="text-indigo-400" />
              </div>
              <h3 className="text-sm font-semibold text-[#e6edf3] mb-2">{title}</h3>
              <p className="text-xs text-[#8b949e] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Roles ──────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-16 border-t border-[#21262d]">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-semibold text-[#e6edf3] mb-3">Un sistema para cada rol</h2>
          <p className="text-[#8b949e] max-w-xl mx-auto text-sm">
            Cada usuario ve una interfaz adaptada a su función dentro del programa ADSO.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roles.map(({ label, desc, color }) => (
            <div key={label} className="bg-[#161b22] border border-[#21262d] rounded-xl p-5 flex items-start gap-4 hover:border-[#30363d] transition-colors">
              <span className={`text-xs font-medium px-2.5 py-1 rounded-md border shrink-0 mt-0.5 ${color}`}>{label}</span>
              <p className="text-sm text-[#8b949e] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────── */}
      <section className="border-t border-[#21262d]">
        <div className="max-w-6xl mx-auto px-6 py-16 text-center">
          <div className="flex items-center justify-center gap-2 text-[#3fb950] text-sm mb-4">
            <Lock size={14} />
            <span>Acceso restringido a aprendices, instructores y coordinadores SENA</span>
          </div>
          <h2 className="text-2xl font-semibold text-[#e6edf3] mb-3">¿Tienes una cuenta en Kanbana?</h2>
          <p className="text-[#8b949e] mb-8 text-sm">
            Si ya tienes credenciales asignadas por tu coordinador, inicia sesión para acceder a tu espacio.
          </p>
          <button
            onClick={openLoginPopup}
            className="inline-flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-colors"
          >
            Iniciar sesión <ArrowRight size={15} />
          </button>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-[#21262d]">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between text-xs text-[#8b949e]">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-indigo-600 rounded flex items-center justify-center">
              <span className="text-[9px] font-bold text-white">K</span>
            </div>
            <span>Kanbana · Sistema de gestión de proyectos SENA ADSO</span>
          </div>
          <span>v1.0 · 2026</span>
        </div>
      </footer>
    </div>
  );
};
