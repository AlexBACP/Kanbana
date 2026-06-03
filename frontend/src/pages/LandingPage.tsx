/**
 * LandingPage — ruta pública "/"
 */
import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { LoginAside } from '../components/LoginAside';
import { KanbanaLogo } from '../components/KanbanaLogo';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Kanban, Users, FileText, BarChart2, Bell, ShieldCheck,
  Send, CheckCircle2,
} from 'lucide-react';
import { authService } from '../services/auth.service';
import { SystemShowcase } from '../components/landing/SystemShowcase';
import { RoleCards3D } from '../components/landing/RoleCards3D';


// ─────────────────────────────────────────────────────────────────────────────
// Collage vivo — lienzo libre (sin caja): cada imagen flota, cambia de tamaño,
// posición, rotación y de foto, con su propio ritmo. Los bordes se difuminan
// con una máscara radial para que no parezca un rectángulo recortado.
// ─────────────────────────────────────────────────────────────────────────────
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

interface TileBase {
  top: string; left: string; w: number; h: number; bright: number; z: number;
}

// FloatingTile — una imagen del collage que flota, cambia de tamaño, posición,
// rotación y de foto, con su propio ritmo aleatorio.
const FloatingTile = ({ pool, base, delay }: { pool: string[]; base: TileBase; delay: number }) => {
  const [img, setImg] = useState(() => pick(pool));
  const [t,   setT]   = useState({ x: 0, y: 0, scale: 1, rotate: rand(-5, 5) });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setImg(pick(pool));                          // nueva imagen
      setT({
        x:      rand(-38, 38),                     // deriva horizontal
        y:      rand(-30, 30),                     // deriva vertical
        scale:  rand(0.8, 1.25),                   // cambia de tamaño
        rotate: rand(-7, 7),                       // ligera rotación
      });
      timer = setTimeout(tick, rand(3800, 7400));  // ritmo propio
    };
    timer = setTimeout(tick, delay);               // arranque escalonado
    return () => clearTimeout(timer);
  }, [pool, delay]);

  return (
    <motion.div
      className="absolute rounded-2xl overflow-hidden shadow-2xl shadow-black/40 ring-1 ring-white/10"
      style={{ top: base.top, left: base.left, width: base.w, height: base.h, zIndex: base.z, filter: `brightness(${base.bright})` }}
      animate={{ x: t.x, y: t.y, scale: t.scale, rotate: t.rotate }}
      transition={{ duration: 2.4, ease: [0.4, 0, 0.2, 1] }}
    >
      <AnimatePresence>
        <motion.img
          key={img}
          src={img}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
        />
      </AnimatePresence>
    </motion.div>
  );
};

// ── Bancos de imágenes ────────────────────────────────────────────────────────
const poolSlot1 = [
  'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1607799279861-4dd421887fb3?auto=format&fit=crop&w=900&q=80',
];
const poolSlot2 = [
  'https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=900&q=80',
];
const poolSlot3 = [
  'https://images.unsplash.com/photo-1515169067868-5387ec356754?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=900&q=80',
];
const poolSlot4 = [
  'https://images.unsplash.com/photo-1542831371-29b0f74f9713?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=900&q=80',
];
const poolSlot5 = [
  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=900&q=80',
];

// Banco completo (para las baldosas "comodín" que pueden mostrar cualquier foto)
const COLLAGE_POOL = [...poolSlot1, ...poolSlot2, ...poolSlot3, ...poolSlot4, ...poolSlot5];

// LiveCollage — 7 imágenes flotando libremente sobre un lienzo sin caja.
// Posiciones base repartidas + solape ligero; el ritmo y los tamaños son
// aleatorios e independientes por baldosa.
const LiveCollage = () => {
  const tiles: { pool: string[]; base: TileBase; delay: number }[] = [
    { pool: poolSlot1,    base: { top: '2%',  left: '3%',  w: 240, h: 175, bright: 0.95, z: 6 }, delay: 200  },
    { pool: poolSlot3,    base: { top: '6%',  left: '46%', w: 185, h: 135, bright: 0.85, z: 4 }, delay: 900  },
    { pool: COLLAGE_POOL, base: { top: '0%',  left: '70%', w: 165, h: 205, bright: 0.9,  z: 8 }, delay: 2600 },
    { pool: poolSlot2,    base: { top: '40%', left: '18%', w: 160, h: 160, bright: 0.8,  z: 7 }, delay: 1300 },
    { pool: poolSlot4,    base: { top: '50%', left: '52%', w: 205, h: 150, bright: 0.78, z: 5 }, delay: 2000 },
    { pool: poolSlot5,    base: { top: '58%', left: '2%',  w: 150, h: 125, bright: 0.82, z: 3 }, delay: 1700 },
    { pool: COLLAGE_POOL, base: { top: '38%', left: '76%', w: 135, h: 125, bright: 0.75, z: 2 }, delay: 3300 },
  ];

  return (
    // Sin máscara ni overflow-hidden: las imágenes se ven COMPLETAS aunque
    // se salgan del área. overflow-visible permite que rebasen libremente.
    <div className="relative h-[420px] overflow-visible sm:h-[480px] md:h-[560px]">
      {/* Resplandor azul de fondo */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_42%_42%,rgba(37,99,235,0.18),transparent_70%)]" />
      {tiles.map((t, i) => (
        <FloatingTile key={i} pool={t.pool} base={t.base} delay={t.delay} />
      ))}
    </div>
  );
};

export const LandingPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isLoading, user } = useAuthStore();

  // Parámetros que abren el panel de acceso automáticamente:
  //   ?redirect=… → la ruta protegida a la que volver tras iniciar sesión
  //   ?error=…    → un error a mostrar (p. ej. fallo del login con Google)
  const redirectAfter = searchParams.get('redirect') ?? undefined;
  const initialError  = searchParams.get('error');

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      navigate(user.rol === 'aprendiz' ? '/kanban' : '/dashboard', { replace: true });
    }
  }, [isAuthenticated, isLoading, user, navigate]);

  // La landing siempre se muestra en azul Y en modo OSCURO, sin importar el
  // tema del usuario. La landing está diseñada sobre fondos oscuros (hero,
  // carrusel, imágenes con texto blanco); si se aplicara el modo claro, los
  // overrides html.light volverían blancos esos fondos y el texto/imagen
  // quedarían ilegibles. Restauramos el tema y modo del usuario al salir.
  useEffect(() => {
    const html = document.documentElement;
    const prevTheme = html.getAttribute('data-theme') ?? 'blue';
    const hadLight  = html.classList.contains('light');
    const hadDim    = html.classList.contains('dim');

    html.setAttribute('data-theme', 'blue');
    html.classList.remove('light', 'dim');
    html.classList.add('dark');

    return () => {
      html.setAttribute('data-theme', prevTheme);
      // Restaurar el modo que tenía el usuario
      html.classList.remove('dark', 'light', 'dim');
      if (hadLight)      html.classList.add('light');
      else if (hadDim)   html.classList.add('dark', 'dim');
      else               html.classList.add('dark');
    };
  }, []);

  const [loginOpen,     setLoginOpen]     = useState(false);

  // ── PQRS ──────────────────────────────────────────────────────────────────
  type PqrsTipo = 'peticion' | 'queja' | 'reclamo' | 'sugerencia';
  interface PqrsForm { nombre: string; correo: string; mensaje: string; }
  const [pqrsTipo, setPqrsTipo] = useState<PqrsTipo>('sugerencia');
  const [pqrsOk,   setPqrsOk]   = useState(false);
  const pqrsForm = useForm<PqrsForm>({ defaultValues: { nombre: '', correo: '', mensaje: '' } });

  const onPqrsSubmit = async (data: PqrsForm) => {
    try {
      await authService.sendPqrs({
        nombre:  data.nombre.trim(),
        correo:  data.correo.trim().toLowerCase(),
        tipo:    pqrsTipo,
        mensaje: data.mensaje.trim(),
      });
      setPqrsOk(true);
      pqrsForm.reset();
    } catch (err: any) {
      pqrsForm.setError('root', {
        message: err?.response?.data?.message || 'No se pudo enviar el mensaje. Intenta de nuevo.',
      });
    }
  };

  // Abrir el panel de acceso automáticamente si llegamos con redirect/error
  useEffect(() => {
    if (redirectAfter || initialError) setLoginOpen(true);
  }, [redirectAfter, initialError]);

  const [currentSlide,  setCurrentSlide]  = useState(0);
  const [slideVisible,  setSlideVisible]  = useState(true);  // para fade del contenido

  const goToLogin = () => setLoginOpen(true);

  const heroSlides = [
    {
      img1:  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
      img2:  'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80',
      title: <>Gestiona tus proyectos <span className="text-blue-400">ADSO</span><br /> con claridad y estructura</>,
      desc:  'Kanbana organiza fichas, proyectos, sprints y tickets en un solo lugar. Un entorno robusto diseñado a la medida del flujo de trabajo académico del SENA.',
    },
    {
      img1:  'https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?auto=format&fit=crop&w=1200&q=80',
      img2:  'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=1200&q=80',
      title: <>Optimiza tus <span className="text-blue-400">Sprints</span><br /> y entregas a tiempo</>,
      desc:  'Planifica metas, asigna tareas críticas a tu equipo y mide el rendimiento real con gráficos intuitivos en tiempo real.',
    },
    {
      img1:  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80',
      img2:  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80',
      title: <>Colaboración ágil<br />para tu <span className="text-blue-400">Ficha Formativa</span></>,
      desc:  'Sincroniza el trabajo de instructores, líderes técnicos y aprendices bajo un esquema seguro de roles y tableros protegidos.',
    },
  ];

  // Hero auto-avance — fade de contenido al cambiar
  useEffect(() => {
    const id = setInterval(() => {
      setSlideVisible(false);
      setTimeout(() => {
        setCurrentSlide(p => (p + 1) % heroSlides.length);
        setSlideVisible(true);
      }, 350);
    }, 5500);
    return () => clearInterval(id);
  }, [heroSlides.length]);

  const goToSlide = (i: number) => {
    if (i === currentSlide) return;
    setSlideVisible(false);
    setTimeout(() => { setCurrentSlide(i); setSlideVisible(true); }, 350);
  };

  const features = [
    { icon: Kanban,    title: 'Tablero Kanban',       desc: 'Visualiza el progreso de cada proyecto con columnas por estado. Arrastra y suelta tickets entre etapas.' },
    { icon: Users,     title: 'Gestión de equipos',   desc: 'Coordinadores, instructores, líderes y aprendices con roles diferenciados y permisos específicos.' },
    { icon: FileText,  title: 'Fichas de formación',  desc: 'Organiza los proyectos ADSO por ficha de formación. Cada grupo tiene sus propios proyectos y sprints.' },
    { icon: BarChart2, title: 'Métricas y seguimiento', desc: 'Velocidad por sprint, burnup de proyecto y estadísticas de avance en tiempo real.' },
    { icon: Bell,      title: 'Notificaciones',        desc: 'Alertas automáticas de cambios de estado, asignaciones y actualizaciones del proyecto.' },
    { icon: ShieldCheck, title: 'Control de acceso',  desc: 'Cada rol ve solo lo que necesita. Seguridad basada en JWT con tokens de acceso y refresco.' },
  ];



  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100 font-sans overflow-x-hidden selection:bg-blue-600 selection:text-white">

      {/* ── NAVBAR ─────────────────────────────────────────────────────────── */}
      <div className="fixed top-0 left-0 right-0 z-50 px-4 pt-5 pb-2 bg-transparent">
        <div className="mx-auto max-w-[1100px]">
          <div className="flex h-[58px] items-center justify-between rounded-md bg-white px-5 shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-zinc-200">
            <KanbanaLogo
              size={36}
              withText
              subtitle="SENA · ADSO"
              textClass="text-[17px] text-zinc-900"
              subClass="text-zinc-400"
            />
            <nav className="hidden md:flex items-center gap-6 text-[16px] font-bold text-black">
              <a className="text-blue-400"               href="#about">Inicio</a>
              <a className="hover:text-zinc-700 transition-colors" href="#features">Funcionalidades</a>
              <a className="hover:text-zinc-700 transition-colors" href="#roles">Roles</a>
              <a className="hover:text-zinc-700 transition-colors" href="#contact">Soporte</a>
            </nav>
            <div className="flex items-center gap-2">
              {/* El selector de tema vive en Configuración (post-login). La landing
                  es siempre azul + oscuro por diseño; tener el toggle aquí hacía que
                  al cambiar de modo el acento saltara al color guardado del usuario. */}
              <button
                onClick={goToLogin}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-md transition-all shadow-sm active:scale-95"
              >
                Iniciar sesión <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <header id="about" className="relative mx-auto max-w-full overflow-hidden rounded-b-[32px] bg-zinc-900 shadow-[0_30px_70px_rgba(0,0,0,0.6)]">
        <section className="relative min-h-[550px] overflow-hidden rounded-b-[32px] md:min-h-[620px]">

          {heroSlides.map((slide, idx) => (
            <div
              key={idx}
              className={`absolute inset-0 grid grid-cols-1 md:grid-cols-2 transition-opacity duration-1000 ease-in-out ${
                idx === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'
              }`}
            >
              <div style={{ backgroundImage: `url(${slide.img1})` }} className="relative bg-cover bg-center">
                <div className="absolute inset-0 bg-zinc-950/75" />
              </div>
              <div style={{ backgroundImage: `url(${slide.img2})` }} className="relative bg-cover bg-center">
                <div className="absolute inset-0 bg-zinc-950/50" />
              </div>
            </div>
          ))}

          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.1),rgba(0,0,0,.75))] z-20 pointer-events-none" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(9,9,11,.5)_0%,rgba(9,9,11,.5)_49.8%,rgba(9,9,11,.1)_50.2%,rgba(9,9,11,.1)_100%)] z-20 pointer-events-none" />

          {/* Anillos decorativos estáticos */}
          <div className="absolute left-[-90px]  top-[60px] h-[600px] w-[600px] rounded-full border border-white/5         pointer-events-none z-20" />
          <div className="absolute right-[-120px] top-[80px] h-[500px] w-[500px] rounded-full border border-blue-600/10  pointer-events-none z-20" />

          {/* Título con fade al cambiar slide */}
          <div className="relative z-30 flex min-h-[550px] md:min-h-[620px] items-center px-6 pt-28 pb-16 md:px-16">
            <div
              className="max-w-[800px] transition-opacity duration-300 ease-in-out"
              style={{ opacity: slideVisible ? 1 : 0 }}
            >
              <h1 className="text-[44px] font-black leading-[0.95] tracking-[-0.06em] text-white md:text-[68px]">
                {heroSlides[currentSlide].title}
              </h1>
            </div>
          </div>
        </section>

        {/* Panel de descripción + controles */}
        <div className="relative z-30 -mt-10 mx-4 mb-6 overflow-hidden rounded-md bg-zinc-900/95 backdrop-blur-md border border-zinc-800/80 px-6 py-8 shadow-[0_25px_60px_rgba(0,0,0,0.7)] md:mx-8 md:px-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
            <div className="md:col-span-2">
              <p
                className="text-[14px] leading-relaxed text-zinc-300 font-normal min-h-[45px] transition-opacity duration-300"
                style={{ opacity: slideVisible ? 1 : 0 }}
              >
                {heroSlides[currentSlide].desc}
              </p>
            </div>
            <div className="flex justify-end w-full">
              <button
                onClick={goToLogin}
                className="w-full md:w-auto flex items-center justify-center gap-2.5 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-black rounded-md transition-all shadow-lg hover:shadow-blue-600/20 active:scale-95"
              >
                Acceder al sistema <ArrowRight size={16} />
              </button>
            </div>
          </div>

          {/* Indicadores clickables */}
          <div className="flex gap-2.5 mt-6">
            {heroSlides.map((_, i) => (
              <button
                key={i}
                onClick={() => goToSlide(i)}
                className={`h-2 rounded-full transition-all duration-500 ${
                  i === currentSlide ? 'w-8 bg-blue-600' : 'w-2.5 bg-zinc-700 hover:bg-zinc-500'
                }`}
              />
            ))}
          </div>
        </div>
      </header>

      {/* ── COLLAGE VIVO ───────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1100px] px-4 py-16 md:py-24 overflow-visible">
        <div className="grid gap-12 md:grid-cols-[1.25fr_.75fr] md:items-center">

          {/* Lienzo libre — imágenes flotando sin caja */}
          <LiveCollage />

          <div className="relative pl-0 md:pl-6">
            <h2 className="text-[36px] font-extrabold tracking-[-0.05em] text-blue-400 md:text-[54px]">Estructura Ágil</h2>
            <p className="mt-4 max-w-[440px] text-[20px] leading-6 text-zinc-400">
              Nuestra metodología transforma el seguimiento pedagógico tradicional en un ecosistema de desarrollo ágil.
              Facilita la asignación transparente de actividades, reduce la fricción operativa y permite un control
              completo de entregables de software.
            </p>
          </div>
        </div>
      </section>

      {/* ── FUNCIONALIDADES — mockup animado del sistema con callouts ───────── */}
      <section id="features" className="bg-zinc-900 border-y border-zinc-800 py-20">
        <div className="mx-auto max-w-[1180px] px-4">
          <div className="mb-14 text-center">
            <h2 className="text-[36px] font-extrabold tracking-[-0.05em] text-blue-400 md:text-[46px]">Funcionalidades</h2>
            <p className="mx-auto mt-2 max-w-xl text-xs text-zinc-400">
              Un solo ecosistema: tablero en vivo, equipos, fichas, métricas, notificaciones y seguridad — todo conectado.
            </p>
          </div>

          <SystemShowcase features={features} />
        </div>
      </section>

      {/* ── INDICADORES ────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1100px] px-4 my-16">
        <div className="overflow-hidden rounded-md bg-gradient-to-r from-zinc-900 to-zinc-950 border border-zinc-800 px-6 py-8 text-white md:px-10 md:py-12 shadow-2xl">
          <div className="grid gap-8 md:grid-cols-[1fr_1.2fr] md:items-center">
            <div className="text-[34px] font-black leading-[1.05] tracking-[-0.05em] md:text-[46px]">
              Control e<br />indicadores<br />de avance
            </div>
            <div className="space-y-4">
              {[
                ['Proyectos Formativos',    '8 Activos en Fichas',            'text-blue-400', true],
                ['Métricas de Tickets',     '24 Abiertos en Cola',            'text-zinc-500',  false],
                ['Evaluación de Entregas',  'Filtro Dinámico por Sprints',     'text-zinc-500',  false],
                ['Esquema de Roles Técnico','JWT Protegido',                   'text-blue-400', true],
              ].map(([label, value, cls, highlight]) => (
                <div key={label as string} className={`flex items-center justify-between border-b border-zinc-800 pb-3 text-[14px] last:border-0 last:pb-0 md:text-[16px]`}>
                  <span className={highlight ? 'font-medium text-zinc-300' : 'text-zinc-400'}>{label}</span>
                  <span className={`text-xs font-semibold ${cls}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── ROLES DEL SISTEMA — tarjetas 3D con tilt ───────────────────────── */}
      <section id="roles" className="bg-zinc-900 border-t border-zinc-800 py-20">
        <div className="mx-auto max-w-[1100px] px-4">
          <div className="mb-12 text-center">
            <h2 className="text-[36px] font-extrabold tracking-[-0.05em] text-blue-400 md:text-[46px]">
              Roles del Sistema
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-xs text-zinc-400">
              Cada perfil ve y hace exactamente lo que le corresponde. Pasa el cursor sobre cada tarjeta.
            </p>
          </div>

          <RoleCards3D />
        </div>
      </section>

      {/* ── SEGURIDAD ──────────────────────────────────────────────────────── */}
      <section className="py-16 mx-auto max-w-[1100px] px-4">
        <h2 className="text-[36px] font-extrabold tracking-[-0.05em] text-blue-400 md:text-[46px]">Seguridad</h2>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <article className="relative min-h-[190px] overflow-hidden bg-zinc-900 border border-zinc-800 text-white rounded-md">
            <div className="relative z-10 p-6 flex flex-col justify-between h-full">
              <div>
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Restricciones</div>
                <h3 className="mt-2 text-[18px] font-bold leading-6">Acceso Corporativo Interno</h3>
                <p className="mt-2 text-[12px] leading-relaxed text-zinc-400">
                  El ingreso está estrictamente reservado para aprendices, instructores y coordinadores vinculados al programa formativo ADSO.
                </p>
              </div>
            </div>
          </article>

          <article
            onClick={goToLogin}
            className="relative min-h-[190px] overflow-hidden bg-zinc-900 border border-zinc-800 text-white rounded-md flex items-center justify-center cursor-pointer hover:border-zinc-700 hover:bg-zinc-900/80 transition-all group"
          >
            <div className="text-center p-6">
              <div className="text-[54px] font-black text-blue-400 leading-none mb-2 transition-transform duration-200 group-hover:scale-110">➜</div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black">Ingresar Ahora</div>
            </div>
          </article>
        </div>
      </section>

      {/* ── PQRS ───────────────────────────────────────────────────────────── */}
      <section id="contact" className="relative overflow-hidden bg-zinc-900 border-t border-zinc-800 py-20">
        <div className="absolute left-0 top-0 text-blue-400 text-[88px] font-black leading-none -translate-y-4 opacity-10 select-none pointer-events-none">∿∿∿</div>
        <div className="mx-auto max-w-[1100px] px-4">

          {/* Encabezado */}
          <div className="mb-10">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-400 mb-1">
              Peticiones · Quejas · Reclamos · Sugerencias
            </p>
            <h2 className="text-[36px] font-extrabold tracking-[-0.05em] text-white md:text-[46px]">PQRS</h2>
            <p className="mt-1 text-[12px] text-zinc-400 max-w-md">
              Escríbenos directamente. Revisamos cada mensaje y respondemos a tu correo a la brevedad.
            </p>
          </div>

          <div className="grid gap-10 md:grid-cols-[1.4fr_.6fr] md:items-start">

            {/* Formulario */}
            <div>
              {pqrsOk ? (
                <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                    <CheckCircle2 size={28} className="text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-white">¡Mensaje enviado!</p>
                    <p className="text-sm text-zinc-400 mt-1">Te responderemos al correo que indicaste.</p>
                  </div>
                  <button
                    onClick={() => { setPqrsOk(false); setPqrsTipo('sugerencia'); }}
                    className="mt-2 text-xs text-blue-400 hover:text-blue-300 font-bold transition-colors"
                  >
                    Enviar otro mensaje
                  </button>
                </div>
              ) : (
                <form onSubmit={pqrsForm.handleSubmit(onPqrsSubmit)} className="space-y-5">

                  {/* Tipo */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Tipo de solicitud</p>
                    <div className="flex flex-wrap gap-2">
                      {([
                        ['peticion',   'Petición'],
                        ['queja',      'Queja'],
                        ['reclamo',    'Reclamo'],
                        ['sugerencia', 'Sugerencia'],
                      ] as [PqrsTipo, string][]).map(([val, label]) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setPqrsTipo(val)}
                          className={`px-4 py-1.5 rounded-full text-xs font-black border transition-all ${
                            pqrsTipo === val
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : 'bg-transparent border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Nombre + Correo en grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                        Nombre
                      </label>
                      <input
                        {...pqrsForm.register('nombre', {
                          required: 'Campo obligatorio',
                          minLength: { value: 3, message: 'Mínimo 3 caracteres' },
                        })}
                        type="text"
                        placeholder="Tu nombre completo"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all"
                      />
                      {pqrsForm.formState.errors.nombre &&
                        <p className="text-[11px] text-rose-400">{pqrsForm.formState.errors.nombre.message}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                        Correo electrónico
                      </label>
                      <input
                        {...pqrsForm.register('correo', {
                          required: 'Campo obligatorio',
                          pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Formato inválido' },
                        })}
                        type="email"
                        placeholder="tu@correo.com"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all"
                      />
                      {pqrsForm.formState.errors.correo &&
                        <p className="text-[11px] text-rose-400">{pqrsForm.formState.errors.correo.message}</p>}
                    </div>
                  </div>

                  {/* Mensaje */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                      Mensaje
                    </label>
                    <textarea
                      {...pqrsForm.register('mensaje', {
                        required: 'Campo obligatorio',
                        minLength: { value: 10, message: 'Mínimo 10 caracteres' },
                        maxLength: { value: 2000, message: 'Máximo 2000 caracteres' },
                      })}
                      rows={5}
                      placeholder="Describe tu petición, queja, reclamo o sugerencia con el mayor detalle posible..."
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all resize-none"
                    />
                    {pqrsForm.formState.errors.mensaje &&
                      <p className="text-[11px] text-rose-400">{pqrsForm.formState.errors.mensaje.message}</p>}
                  </div>

                  {/* Error global */}
                  {pqrsForm.formState.errors.root && (
                    <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-md px-3 py-2">
                      {pqrsForm.formState.errors.root.message}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={pqrsForm.formState.isSubmitting}
                    className="flex items-center gap-2 px-7 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-black rounded-md transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]"
                  >
                    {pqrsForm.formState.isSubmitting
                      ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Enviando...</>
                      : <><Send size={14} /> Enviar mensaje</>}
                  </button>
                </form>
              )}
            </div>

            {/* Info lateral */}
            <div className="space-y-6 pt-2 md:pt-1">
             
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Soporte directo</p>
                <p className="text-sm font-semibold text-blue-400"> <a href="https://mail.google.com/mail/u/0/#search/ofra1714%40gmail.com?compose=CllgCJlGTpjfWGlrJNTPfvkjPjVszXTHzDDlBGDJxKflwWWMfBhFXncXNJNzDcRwNTBLkXHKQRg">kanbana70@gmail.com</a></p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer className="bg-blue-600 py-12 text-white">
        <div className="mx-auto max-w-[1100px] px-4">
          <div className="grid gap-8 md:grid-cols-[1.2fr_.8fr] md:items-end">

            {/* Branding — logo animado reutilizado */}
            <div>
              <KanbanaLogo
                size={42}
                withText
                subtitle="SENA · ADSO"
                textClass="text-[18px] text-white font-black uppercase tracking-wide"
                subClass="text-white/70"
                iconBorder="ring-1 ring-white/20"
              />
              <p className="mt-4 max-w-[390px] text-[12px] leading-relaxed text-white/90 font-normal">
                Kanbana es una plataforma orientada a la planeación, control dinámico y despliegue estructurado
                de portafolios tecnológicos en ambientes formativos de desarrollo de software.
              </p>
            </div>

            <div className="md:text-right">
              <div className="flex flex-wrap gap-5 text-[12px] font-bold justify-start md:justify-end text-white/90">
                <a href="#about"    className="hover:text-white transition-colors">Inicio</a>
                <a href="#features" className="hover:text-white transition-colors">Funcionalidades</a>
                <a href="#roles"    className="hover:text-white transition-colors">Roles</a>
              </div>
              <div className="mt-4 flex gap-2 text-[12px] justify-start md:justify-end text-white/50 select-none">
                <span>Flow</span><span>●</span><span>●</span><span>●</span>
              </div>
            </div>
          </div>
        </div>
      </footer>

      <LoginAside
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        redirectAfter={redirectAfter}
        initialError={initialError}
      />
    </div>
  );
};
