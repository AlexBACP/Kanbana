/**
 * LandingPage — ruta pública "/"
 */
import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { LoginAside } from '../components/LoginAside';
import { KanbanaLogo } from '../components/KanbanaLogo';
import {
  ArrowRight, Kanban, Users, FileText, BarChart2, Bell, ShieldCheck,
  ChevronLeft, ChevronRight, Sun, Moon, Contrast,
} from 'lucide-react';

/** Cicla entre los 3 modos de tema */
const ThemeToggle = () => {
  const { settings, updateSettings } = useAuthStore();
  const mode = settings.themeMode ?? 'dark';
  const next  = mode === 'dark' ? 'light' : mode === 'light' ? 'dim' : 'dark';
  const Icon  = mode === 'dark' ? Moon : mode === 'light' ? Sun : Contrast;
  const label = mode === 'dark' ? 'Oscuro' : mode === 'light' ? 'Claro' : 'Atenuado';
  return (
    <button
      onClick={() => updateSettings({ themeMode: next })}
      title={`Tema actual: ${label} — clic para cambiar`}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 text-xs font-bold transition-all"
    >
      <Icon size={13} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CollageImage — crossfade suave entre imágenes (sin scale ni border-radius)
// ANTES: scale-0 + rounded-full → parecía girar/encogerse en círculo
// AHORA: fade de opacidad simple, profesional
// ─────────────────────────────────────────────────────────────────────────────
const CollageImage = ({ images, className }: { images: string[]; className: string }) => {
  const [current, setCurrent] = useState(0);
  const [fading,  setFading]  = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    // Delay inicial aleatorio para que no todas las imágenes cambien a la vez
    const initialDelay = initialized.current ? 0 : Math.random() * 3000;
    initialized.current = true;

    const start = () => {
      const cycleTime = 5000 + Math.random() * 4000;   // 5–9 s entre cambios
      return setInterval(() => {
        setFading(true);                                 // fade out (500 ms)
        setTimeout(() => {
          setCurrent(p => (p + 1) % images.length);
          setFading(false);                              // fade in
        }, 500);
      }, cycleTime);
    };

    let id: ReturnType<typeof setInterval>;
    const tid = setTimeout(() => { id = start(); }, initialDelay);

    return () => { clearTimeout(tid); clearInterval(id); };
  }, [images.length]);

  return (
    <div className={`relative overflow-hidden rounded-md ${className}`}>
      <img
        src={images[current]}
        alt="Ecosistema de Desarrollo"
        className={`w-full h-full object-cover transition-opacity duration-500 ease-in-out ${
          fading ? 'opacity-0' : 'opacity-100'
        }`}
      />
    </div>
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

  // La landing siempre se muestra en azul sin importar el tema del usuario
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.getAttribute('data-theme') ?? 'blue';
    html.setAttribute('data-theme', 'blue');
    return () => { html.setAttribute('data-theme', prev); };
  }, []);

  const [loginOpen,     setLoginOpen]     = useState(false);

  // Abrir el panel de acceso automáticamente si llegamos con redirect/error
  useEffect(() => {
    if (redirectAfter || initialError) setLoginOpen(true);
  }, [redirectAfter, initialError]);

  const [currentSlide,  setCurrentSlide]  = useState(0);
  const [slideVisible,  setSlideVisible]  = useState(true);  // para fade del contenido
  const [featureOffset, setFeatureOffset] = useState(0);

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

  const roles = [
    { label: 'Coordinador',   desc: 'Gestiona fichas, usuarios y todos los proyectos del programa.' },
    { label: 'Instructor',    desc: 'Supervisa los proyectos de sus fichas asignadas y aprendices.' },
    { label: 'Líder técnico', desc: 'Dirige el equipo de desarrollo, gestiona backlog y sprints.' },
    { label: 'Aprendiz',      desc: 'Trabaja sus tickets asignados desde el tablero Kanban personal.' },
  ];

  const handlePrevFeature = () => setFeatureOffset(p => Math.max(p - 1, 0));
  const handleNextFeature  = () => setFeatureOffset(p => Math.min(p + 1, features.length - 3));

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
              <ThemeToggle />
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

      {/* ── COLLAGE ASIMÉTRICO ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1100px] px-4 py-16 md:py-24">
        <div className="grid gap-12 md:grid-cols-[1.2fr_.8fr] md:items-center">

          <div className="relative grid grid-cols-3 gap-3 auto-rows-[110px] md:auto-rows-[135px]">
            {/* Adornos estáticos — sin animate-pulse en el punto para no añadir movimiento */}
            <div className="absolute -top-4 left-[10%] h-3 w-3 rounded-full bg-blue-600/60 z-20" />
            <div className="absolute right-[-10px] bottom-[-10px] h-12 w-12 rounded-full border-2 border-zinc-800 pointer-events-none" />

            {/* Slots del collage — todos usan crossfade ahora */}
            <CollageImage images={poolSlot1} className="col-span-2 row-span-2 brightness-90 contrast-105 shadow-xl" />
            <CollageImage images={poolSlot2} className="col-span-1 row-span-1 brightness-75 shadow-lg" />
            <CollageImage images={poolSlot3} className="col-span-1 row-span-1 brightness-75 shadow-lg" />
            <CollageImage images={poolSlot4} className="col-span-1 row-span-1 brightness-75 shadow-lg" />
            <CollageImage images={poolSlot5} className="col-span-2 row-span-1 brightness-80 shadow-lg" />
          </div>

          <div className="relative pl-0 md:pl-6">
            <h2 className="text-[36px] font-extrabold tracking-[-0.05em] text-blue-400 md:text-[46px]">Estructura Ágil</h2>
            <p className="mt-4 max-w-[440px] text-[13px] leading-6 text-zinc-400">
              Nuestra metodología transforma el seguimiento pedagógico tradicional en un ecosistema de desarrollo ágil.
              Facilita la asignación transparente de actividades, reduce la fricción operativa y permite un control
              completo de entregables de software.
            </p>
          </div>
        </div>
      </section>

      {/* ── CARRUSEL DE FUNCIONALIDADES ────────────────────────────────────── */}
      <section id="features" className="bg-zinc-900 border-y border-zinc-800 py-16">
        <div className="mx-auto max-w-[1100px] px-4">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-[36px] font-extrabold tracking-[-0.05em] text-blue-400 md:text-[46px]">Funcionalidades</h2>
              <p className="text-zinc-400 text-xs mt-1">Explora los módulos integrados y automatizados del ecosistema.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handlePrevFeature}
                disabled={featureOffset === 0}
                className="w-10 h-10 border border-zinc-700 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-300 hover:bg-zinc-700 hover:text-white transition-all disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={handleNextFeature}
                disabled={featureOffset >= features.length - 3}
                className="w-10 h-10 border border-zinc-700 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-300 hover:bg-zinc-700 hover:text-white transition-all disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="overflow-hidden relative px-1 py-4">
            <div
              className="flex gap-5 transition-transform duration-500 ease-in-out"
              style={{ transform: `translateX(-${featureOffset * (265 + 20)}px)` }}
            >
              {features.map(({ icon: Icon, title, desc }) => (
                <article key={title} className="min-w-[265px] max-w-[265px] rounded-md bg-zinc-950 border border-zinc-800 shadow-xl flex flex-col justify-between hover:-translate-y-1 hover:border-zinc-700 transition-transform duration-200">
                  <div className="p-6">
                    <div className="w-10 h-10 bg-blue-600/10 text-blue-400 border border-blue-600/20 rounded-md flex items-center justify-center mb-5">
                      <Icon size={18} />
                    </div>
                    <h3 className="text-[15px] font-bold text-zinc-100 tracking-tight mb-2.5">{title}</h3>
                    <p className="text-[12px] text-zinc-400 leading-relaxed">{desc}</p>
                  </div>
                  <div className="flex items-center justify-between bg-zinc-900 border-t border-zinc-800/80 px-5 py-3 text-white rounded-b-[16px]">
                    <span className="text-[10px] font-bold text-zinc-500 tracking-wider uppercase">Módulo ADSO</span>
                    <button
                      onClick={goToLogin}
                      className="grid h-7 w-7 place-items-center rounded-full bg-blue-600 text-xs font-bold text-white hover:bg-blue-700 transition-colors"
                    >
                      ➜
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
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

      {/* ─────────────────────────────────────────────────────────────────────
          ROLES DEL SISTEMA — marquee infinito
          FIX: en lugar de gap-5 (que no incluye trailing space), cada tarjeta
          lleva mr-5 (margin-right = 20px). Así el ancho total es exactamente
          N × (230px + 20px) = N × 250px y translateX(-50%) = -[N/2 × 250px]
          que es exactamente la anchura del primer set → loop sin salto.
      ───────────────────────────────────────────────────────────────────── */}
      <section id="roles" className="bg-zinc-900 border-t border-zinc-800 py-16 overflow-hidden">
        <div className="mx-auto max-w-[1100px] px-4">
          <h2 className="text-[36px] font-extrabold tracking-[-0.05em] text-blue-400 md:text-[46px]">
            Roles del Sistema
          </h2>

          <div className="relative mt-10">
            {/* Decoración lateral */}
            <div className="absolute right-[-18px] top-[18%] hidden text-blue-400 text-[160px] leading-none md:block opacity-10 select-none pointer-events-none">
              ∿
            </div>

            {/* Track del marquee
                group: al hacer hover, pause the animation via CSS class  */}
            <div className="group overflow-hidden">
              {/*
                MATH: 4 roles × (230px + mr-5/20px) = 4 × 250px = 1000px por set
                La animación mueve -1000px exactos → el segundo set cae
                justo donde estaba el primero → loop 100% sin salto visible.
              */}
              <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused]">
                {[...roles, ...roles].map(({ label, desc }, index) => (
                  <article
                    key={`${label}-${index}`}
                    className="
                      relative min-w-[230px] max-w-[230px] mr-5
                      overflow-hidden rounded-md bg-blue-600 shadow-xl
                      flex flex-col justify-between
                      cursor-default select-none
                    "
                  >
                    {/* Header con imagen */}
                    <div className="relative h-[140px] overflow-hidden">
                      <img
                        src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1200&auto=format&fit=crop"
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover scale-110"
                      />
                      <div className="absolute inset-0 bg-black/65" />
                      <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/40 to-transparent" />
                      <div className="relative z-10 flex h-full items-center justify-center p-5">
                        <span className="text-white font-black text-[15px] tracking-[0.18em] uppercase text-center drop-shadow-lg">
                          {label}
                        </span>
                      </div>
                    </div>

                    {/* Contenido */}
                    <div className="px-5 py-5 text-white flex-1 flex flex-col justify-between">
                      <p className="text-[12px] text-white/90 leading-relaxed mb-5">{desc}</p>
                      <div className="flex gap-2 text-[10px] opacity-50 select-none">◔ ◔ ◔</div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
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

      {/* ── CONTACTO ───────────────────────────────────────────────────────── */}
      <section id="contact" className="relative overflow-hidden bg-zinc-900 border-t border-zinc-800 py-16">
        <div className="absolute left-0 top-0 text-blue-400 text-[88px] font-black leading-none -translate-y-4 opacity-10 select-none pointer-events-none">∿∿∿</div>
        <div className="mx-auto max-w-[1100px] px-4">
          <div className="grid gap-8 md:grid-cols-[1.15fr_.85fr] md:items-start">
            <div>
              <h2 className="text-[36px] font-extrabold tracking-[-0.05em] text-blue-400 md:text-[46px]">¿Tienes Dudas?</h2>
              <p className="mt-1 text-[12px] text-zinc-400">Comunícate con la mesa de administración técnica del sistema.</p>
              <form className="mt-8 space-y-6">
                <div>
                  <label className="mb-2 block text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black">Nombre del Instructor o Aprendiz</label>
                  <div className="h-[1px] bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800" />
                </div>
                <div>
                  <label className="mb-2 block text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black">Correo Electrónico MiSena</label>
                  <div className="h-[1px] bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800" />
                </div>
                <button
                  type="button"
                  onClick={goToLogin}
                  className="grid h-11 w-24 place-items-center rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-md active:scale-95"
                >
                  ➜
                </button>
              </form>
            </div>
            <div className="relative pt-8 md:pt-0 md:pl-6 text-[13px] text-zinc-400">
              <div className="absolute bottom-2 left-[22%] h-16 w-16 rounded-full border-2 border-zinc-800 opacity-50" />
              <div className="space-y-5 pt-12">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black">Canal Principal de Soporte</div>
                  <div className="mt-1 font-semibold text-zinc-200">soporte.kanbana@sena.edu.co</div>
                </div>
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
