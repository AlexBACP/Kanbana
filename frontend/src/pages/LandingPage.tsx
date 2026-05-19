/**
 * LandingPage — ruta pública "/"
 *
 * ── EVOLUCIÓN COMPLETA DE INTERFAZ Y REQUERIMIENTOS INTERACTIVOS ───────────
 * 1. Paleta de colores totalmente oscura (Estilo Premium Dark Tech).
 * 2. Navbar blanca flotante con posición fija (Fixed en el tope del scroll).
 * 3. Galería/Slideshow dinámico automatizado en el Hero de 5 segundos.
 * 4. Carrusel de funcionalidades interactivo con botones y animación suave.
 * ──────────────────────────────────────────────────────────────────────────
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { LoginAside } from '../components/LoginAside';
import { 
  ArrowRight, Kanban, Users, FileText, BarChart2, Bell, ShieldCheck, 
  ChevronLeft, ChevronRight 
} from 'lucide-react';

// ── SUBCOMPONENTE PARA CADA IMAGEN DEL COLLAGE ANIMADO ──────────────────
const CollageImage = ({ images, className }: { images: string[]; className: string }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    // Genera un tiempo aleatorio entre 4 y 8 segundos para que no se animen al mismo tiempo
    const randomInterval = 4000 + Math.random() * 4000;

    const interval = setInterval(() => {
      // 1. Inicia animación: Se cierra en círculo y se hace pequeño
      setIsTransitioning(true);

      // 2. Espera a que termine de encogerse (600ms) para cambiar la imagen en secreto
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % images.length);
        // 3. Expande la nueva imagen volviendo a su forma original
        setIsTransitioning(false);
      }, 600);

    }, randomInterval);

    return () => clearInterval(interval);
  }, [images.length]);

  return (
    <div className={`relative overflow-hidden w-full h-full ${className}`}>
      <img
        src={images[currentIndex]}
        alt="Ecosistema de Desarrollo"
        className={`w-full h-full object-cover transition-all duration-700 ease-in-out origin-center ${
          isTransitioning
            ? 'rounded-full scale-0 opacity-0'
            : 'rounded-[16px] scale-100 opacity-100'
        }`}
      />
    </div>
  );
};

// BANCOS DE IMÁGENES PREMIUM (Cada slot rota aleatoriamente entre sus opciones)
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
  const { isAuthenticated, isLoading, user } = useAuthStore();

  // ==========================================
  // LÓGICA DE CONTROL DEL RESPALDO AUTH (LOGIC INTACT)
  // ==========================================
  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      navigate(user.rol === 'aprendiz' ? '/kanban' : '/dashboard', { replace: true });
    }
  }, [isAuthenticated, isLoading, user, navigate]);

  const goToLogin = () => {
    navigate('/login');
  };

  // ==========================================
  // ESTADOS NUEVOS: INTERACTIVIDAD Y ANIMACIÓN
  // ==========================================
  const [currentSlide, setCurrentSlide] = useState(0);
  const [featureOffset, setFeatureOffset] = useState(0);

  // 1. DATA SLIDESHOW HERO (Imágenes + Contenidos sincronizados)
  const heroSlides = [
    {
      img1: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
      img2: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80',
      title: <>Gestiona tus proyectos <span className="text-[#27ae60]">ADSO</span><br /> con claridad y estructura</>,
      desc: 'Kanbana organiza fichas, proyectos, sprints y tickets en un solo lugar de manera impecable. Un entorno robusto diseñado a la medida del flujo de trabajo académico y de desarrollo del SENA.'
    },
    {
      img1: 'https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?auto=format&fit=crop&w=1200&q=80',
      img2: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=1200&q=80',
      title: <>Optimiza tus <span className="text-[#27ae60]">Sprints</span><br /> y entregas a tiempo</>,
      desc: 'Planifica tus metas semanales, asigna tareas críticas a tu equipo de desarrollo y mide el rendimiento real con gráficos intuitivos integrados en tiempo real.'
    },
    {
      img1: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80',
      img2: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80',
      title: <>Colaboración ágil<br />para tu <span className="text-[#27ae60]">Ficha Formativa</span></>,
      desc: 'Sincroniza el trabajo de instructores, líderes técnicos y aprendices bajo un esquema seguro de roles y un flujo constante de tableros protegidos.'
    }
  ];

  // Temporizador automático de 5 segundos para el Hero
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [heroSlides.length]);

  // 2. DATA FUNCIONALIDADES
  const features = [
    { icon: Kanban, title: 'Tablero Kanban', desc: 'Visualiza el progreso de cada proyecto con columnas por estado. Arrastra y suelta tickets entre etapas.' },
    { icon: Users, title: 'Gestión de equipos', desc: 'Coordinadores, instructores, líderes y aprendices con roles diferenciados y permisos específicos.' },
    { icon: FileText, title: 'Fichas de formación', desc: 'Organiza los proyectos ADSO por ficha de formación. Cada grupo tiene sus propios proyectos y sprints.' },
    { icon: BarChart2, title: 'Métricas y seguimiento', desc: 'Velocidad por sprint, burnup de proyecto y estadísticas de avance en tiempo real.' },
    { icon: Bell, title: 'Notificaciones', desc: 'Alertas automáticas de cambios de estado, asignaciones y actualizaciones del proyecto.' },
    { icon: ShieldCheck, title: 'Control de acceso', desc: 'Cada rol ve solo lo que necesita. Seguridad basada en JWT con tokens de acceso y refresco.' },
  ];

  const roles = [
    { label: 'Coordinador', desc: 'Gestiona fichas, usuarios y todos los proyectos del programa.' },
    { label: 'Instructor', desc: 'Supervisa los proyectos de sus fichas asignadas y aprendices.' },
    { label: 'Líder técnico', desc: 'Dirige el equipo de desarrollo, gestiona backlog y sprints.' },
    { label: 'Aprendiz', desc: 'Trabaja sus tickets asignados desde el tablero Kanban personal.' },
  ];

  // Navegación del carrusel de funcionalidades
  const handlePrevFeature = () => {
    setFeatureOffset((prev) => Math.max(prev - 1, 0));
  };

  const handleNextFeature = () => {
    setFeatureOffset((prev) => Math.min(prev + 1, features.length - 3));
  };

  return (
    <div className="min-h-screen bg-[#222226] text-zinc-100 font-sans overflow-x-hidden selection:bg-[#27ae60] selection:text-white">

      {/* ── NAVBAR FLOTANTE MODIFICADA: COMPLETAMENTE LIMPIA Y CON FONDO TRANSPARENTE ───────────────────── */}
      <div className="fixed top-0 left-0 right-0 z-50 px-4 pt-5 pb-2 bg-transparent">
        <div className="mx-auto max-w-[1100px]">
          <div className="flex h-[58px] items-center justify-between rounded-[14px] bg-white px-5 shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-zinc-200">
            
            {/* Logo de Marca */}
            <div className="flex items-center gap-2 text-[18px] font-medium tracking-[-0.04em] text-zinc-900">
              <span className="font-extrabold text-[#27ae60] tracking-tight">Kanbana</span>
              <span className="text-[12px] font-bold text-zinc-500 bg-zinc-100 border border-zinc-200 rounded px-1.5 py-0.5 ml-1">
                SENA · ADSO
              </span>
            </div>

            {/* Navegación Estática Decorativa */}
            <nav className="hidden md:flex items-center gap-6 text-[16px] font-bold text-black">
              <a className="text-[#27ae60]" href="#about">Inicio</a>
              <a className="hover:text-zinc-700 transition-colors" href="#features">Funcionalidades</a>
              <a className="hover:text-zinc-700 transition-colors" href="#roles">Roles</a>
              <a className="hover:text-zinc-700 transition-colors" href="#contact">Soporte</a>
            </nav>

            {/* Acción de Entrada */}
            <button
              onClick={goToLogin}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#27ae60] hover:bg-[#219653] text-white text-xs font-bold rounded-[14px] transition-all shadow-sm active:scale-95"
            >
              Iniciar sesión
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* ── HERO REDISEÑADO: MÁS GRANDE, ALTO IMPACTO Y HASTA EL TOPE SUPERIOR ───────────────────── */}
      <header id="about" className="relative mx-auto max-w-full overflow-hidden rounded-b-[32px] bg-zinc-900 transition-all duration-700 shadow-[0_30px_70px_rgba(0,0,0,0.6)]">
        
        {/* Sección de Imagen: Incrementamos su altura a min-h-[550px] en móviles y [620px] en pantallas medianas */}
        <section className="relative min-h-[550px] overflow-hidden rounded-b-[32px] md:min-h-[620px]">
          
          {/* Mapeo de slides con transición cruzada de opacidad */}
          {heroSlides.map((slide, idx) => (
            <div 
              key={idx}
              className={`absolute inset-0 grid grid-cols-1 md:grid-cols-2 transition-opacity duration-1000 ease-in-out ${
                idx === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'
              }`}
            >
              <div style={{ backgroundImage: `url(${slide.img1})` }} className="relative bg-cover bg-center transition-all duration-700">
                <div className="absolute inset-0 bg-zinc-950/75"></div>
              </div>
              <div style={{ backgroundImage: `url(${slide.img2})` }} className="relative bg-cover bg-center transition-all duration-700">
                <div className="absolute inset-0 bg-zinc-950/50"></div>
              </div>
            </div>
          ))}

          {/* Divisores de Gradiente Estéticos */}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.1),rgba(0,0,0,.75))] z-20 pointer-events-none"></div>
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(9,9,11,.5)_0%,rgba(9,9,11,.5)_49.8%,rgba(9,9,11,.1)_50.2%,rgba(9,9,11,.1)_100%)] z-20 pointer-events-none"></div>

          {/* Anillos Geométricos Decorativos */}
          <div className="absolute left-[-90px] top-[60px] h-[600px] w-[600px] rounded-full border border-white/5 select-none pointer-events-none z-20"></div>
          <div className="absolute right-[-120px] top-[80px] h-[500px] w-[500px] rounded-full border border-[#27ae60]/10 select-none pointer-events-none z-20"></div>

          {/* Contenido del Título Animado (Añadido pt-28 para respetar la barra fija sin ocultar texto) */}
          <div className="relative z-30 flex min-h-[550px] md:min-h-[620px] items-center px-6 pt-28 pb-16 md:px-16 transition-all">
            <div className="max-w-[800px]">
              {/* Tipografía sans mucho más pesada y grande (font-black y text-6xl/7xl) */}
              <h1 className="text-[44px] font-black leading-[0.95] tracking-[-0.06em] text-white md:text-[68px] transition-all duration-500">
                {heroSlides[currentSlide].title}
              </h1>
            </div>
          </div>
        </section>

        {/* Bloque de Información Cambiante Sincronizado (Diseño estilizado con más peso) */}
        <div className="relative z-30 -mt-10 mx-4 mb-6 overflow-hidden rounded-[24px] bg-zinc-900/95 backdrop-blur-md border border-zinc-800/80 px-6 py-8 shadow-[0_25px_60px_rgba(0,0,0,0.7)] md:mx-8 md:px-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
            <div className="md:col-span-2">
              <p className="text-[14px] leading-relaxed text-zinc-300 font-normal min-h-[45px] transition-all duration-500">
                {heroSlides[currentSlide].desc}
              </p>
            </div>
            <div className="flex justify-end w-full">
              <button
                onClick={goToLogin}
                className="w-full md:w-auto flex items-center justify-center gap-2.5 px-8 py-4 bg-[#27ae60] hover:bg-[#219653] text-white text-sm font-black rounded-xl transition-all shadow-lg hover:shadow-[#27ae60]/20 active:scale-95"
              >
                Acceder al sistema
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
          
          {/* Indicadores Visuales de la diapositiva actual */}
          <div className="flex gap-2.5 mt-6 justify-start">
            {heroSlides.map((_, i) => (
              <div 
                key={i} 
                className={`h-2 rounded-full transition-all duration-500 ${i === currentSlide ? 'w-8 bg-[#27ae60]' : 'w-2.5 bg-zinc-800'}`}
              />
            ))}
          </div>
        </div>
      </header>

      {/* ── SECCIÓN ABOUT CON COLLAGE ASIMÉTRICO EXTENDIDO Y ANIMACIONES ALEATORIAS EN CÍRCULO ───────── */}
      <section className="mx-auto max-w-[1100px] px-4 py-16 md:py-24">
        <div className="grid gap-12 md:grid-cols-[1.2fr_.8fr] md:items-center">
          
          {/* Bloque Gráfico Izquierdo: Mosaico denso de 5 imágenes interactivas */}
          <div className="relative grid grid-cols-3 gap-3 auto-rows-[110px] md:auto-rows-[135px]">
            {/* Adornos estéticos de fondo */}
            <div className="absolute -top-4 left-[10%] h-3 w-3 rounded-full bg-[#27ae60] animate-pulse z-20"></div>
            <div className="absolute right-[-10px] bottom-[-10px] h-12 w-12 rounded-full border-2 border-zinc-800 pointer-events-none"></div>
            
            {/* Slot 1: Imagen Principal Grande (Ocupa 2 columnas y 2 filas) */}
            <CollageImage images={poolSlot1} className="col-span-2 row-span-2 filter brightness-90 contrast-105 shadow-xl" />
            
            {/* Slot 2: Superior Derecho */}
            <CollageImage images={poolSlot2} className="col-span-1 row-span-1 filter brightness-75 shadow-lg" />
            
            {/* Slot 3: Medio Derecho */}
            <CollageImage images={poolSlot3} className="col-span-1 row-span-1 filter brightness-75 shadow-lg" />
            
            {/* Slot 4: Inferior Izquierdo */}
            <CollageImage images={poolSlot4} className="col-span-1 row-span-1 filter brightness-75 shadow-lg" />
            
            {/* Slot 5: Inferior Derecho Ancho (Ocupa 2 columnas) */}
            <CollageImage images={poolSlot5} className="col-span-2 row-span-1 filter brightness-80 shadow-lg" />
          </div>

          {/* Contenido Descriptivo */}
          <div className="relative pl-0 md:pl-6">
            <h2 className="text-[36px] font-extrabold tracking-[-0.05em] text-[#27ae60] md:text-[46px]">Estructura Ágil</h2>
            <p className="mt-4 max-w-[440px] text-[13px] leading-6 text-zinc-400">
              Nuestra metodología transforma el seguimiento pedagógico tradicional en un ecosistema de desarrollo ágil. Facilita la asignación transparente de actividades, reduce la fricción operativa y permite un control completo de entregables de software.
            </p>
          </div>
        </div>
      </section>

      {/* ── CARRUSEL INTERACTIVO CON ANIMACIÓN DE FUNCIONALIDADES ──────────────── */}
      <section id="features" className="bg-zinc-900 border-y border-zinc-800 py-16">
        <div className="mx-auto max-w-[1100px] px-4">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-[36px] font-extrabold tracking-[-0.05em] text-[#27ae60] md:text-[46px]">Funcionalidades</h2>
              <p className="text-zinc-400 text-xs mt-1">Explora los módulos integrados y automatizados del ecosistema.</p>
            </div>
            
            {/* Controles del Carrusel con Flechas */}
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

          {/* Ventana de Recorte del Carrusel */}
          <div className="overflow-hidden relative px-1 py-4">
            <div 
              className="flex gap-5 transition-transform duration-500 ease-in-out"
              style={{ transform: `translateX(-${featureOffset * (265 + 20)}px)` }} // Ancho de card + brecha de separación
            >
              {features.map(({ icon: Icon, title, desc }) => (
                <article key={title} className="min-w-[265px] max-w-[265px] rounded-[16px] bg-zinc-950 border border-zinc-800 shadow-xl flex flex-col justify-between transform transition-all hover:-translate-y-1 hover:border-zinc-700">
                  <div className="p-6">
                    {/* Icono encuadrado */}
                    <div className="w-10 h-10 bg-[#27ae60]/10 text-[#27ae60] border border-[#27ae60]/20 rounded-xl flex items-center justify-center mb-5 shadow-inner">
                      <Icon size={18} />
                    </div>
                    <h3 className="text-[15px] font-bold text-zinc-100 tracking-tight mb-2.5">{title}</h3>
                    <p className="text-[12px] text-zinc-400 leading-relaxed">{desc}</p>
                  </div>
                  
                  {/* Pie de Tarjeta */}
                  <div className="flex items-center justify-between bg-zinc-900 border-t border-zinc-800/80 px-5 py-3 text-white rounded-b-[16px]">
                    <span className="text-[10px] font-bold text-zinc-500 tracking-wider uppercase">Módulo ADSO</span>
                    <button 
                      onClick={goToLogin} 
                      className="grid h-7 w-7 place-items-center rounded-full bg-[#27ae60] text-xs font-bold text-white hover:bg-[#219653] transition-colors"
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

      {/* ── PANEL DE INDICADORES (ESTILO OSCURO INTEGRADO) ────────── */}
      <section className="mx-auto max-w-[1100px] px-4 my-16">
        <div className="overflow-hidden rounded-[16px] bg-gradient-to-r from-zinc-900 to-zinc-950 border border-zinc-800 px-6 py-8 text-white md:px-10 md:py-12 shadow-2xl">
          <div className="grid gap-8 md:grid-cols-[1fr_1.2fr] md:items-center">
            <div>
              <div className="text-[34px] font-black leading-[1.05] tracking-[-0.05em] md:text-[46px]">
                Control e<br/>indicadores<br/>de avance
              </div>
            </div>
            {/* Lista con líneas finas oscuras */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3 text-[14px] md:text-[16px]">
                <span className="font-medium text-zinc-300">Proyectos Formativos</span>
                <span className="text-[#27ae60] font-bold text-sm">8 Activos en Fichas</span>
              </div>
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3 text-[14px] text-zinc-400 md:text-[16px]">
                <span>Métricas de Tickets</span>
                <span className="text-zinc-500 text-xs">24 Abiertos en Cola</span>
              </div>
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3 text-[14px] text-zinc-400 md:text-[16px]">
                <span>Evaluación de Entregas</span>
                <span className="text-zinc-500 text-xs">Filtro Dinámico por Sprints</span>
              </div>
              <div className="flex items-center justify-between text-[14px] text-zinc-400 md:text-[16px]">
                <span>Esquema de Roles Técnico</span>
                <span className="text-[#27ae60] text-xs font-semibold">JWT Protegido</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECCIÓN ROLES (TARJETAS VERTICALES VERDES) ─────── */}
      {/* ===================================================== */}
{/* ROLES DEL SISTEMA / CARRUSEL INFINITO */}
{/* ===================================================== */}

<section
  id="roles"
  className="bg-zinc-900 border-t border-zinc-800 py-16 overflow-hidden"
>
  <div className="mx-auto max-w-[1100px] px-4">

    {/* ===================================================== */}
    {/* TÍTULO */}
    {/* ===================================================== */}

    <h2 className="text-[36px] font-extrabold tracking-[-0.05em] text-[#27ae60] md:text-[46px]">
      Roles del Sistema
    </h2>

    {/* ===================================================== */}
    {/* CONTENEDOR DEL CARRUSEL */}
    {/* ===================================================== */}

    <div className="relative mt-10">

      {/* Decoración lateral */}
      <div className="absolute right-[-18px] top-[18%] hidden text-[#27ae60] text-[160px] leading-none md:block opacity-10 select-none pointer-events-none">
        ∿
      </div>

      {/* ===================================================== */}
      {/* TRACK DEL CARRUSEL */}
      {/* ===================================================== */}

      <div className="group overflow-hidden">

        {/* 
          animate-marquee:
          Movimiento horizontal infinito
        */}

        <div className="flex w-max gap-5 animate-marquee group-hover:[animation-play-state:paused]">

          {/* ===================================================== */}
          {/* DUPLICAMOS EL ARRAY PARA LOOP INFINITO */}
          {/* ===================================================== */}

          {[...roles, ...roles].map(({ label, desc }, index) => (

            <article
              key={`${label}-${index}`}
              className="
                relative
                min-w-[230px]
                max-w-[230px]
                overflow-hidden
                rounded-[16px]
                bg-[#27ae60]
                shadow-xl
                flex
                flex-col
                justify-between
                transition-all
                duration-500
                hover:scale-[1.05]
                hover:-translate-y-2
                hover:shadow-[0_25px_60px_rgba(39,174,96,0.35)]
                cursor-pointer
              "
            >

              {/* ===================================================== */}
              {/* HEADER / ROL */}
              {/* ===================================================== */}

              <div className="relative h-[140px] overflow-hidden">

                {/* Imagen de fondo */}
                <img
                  src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1200&auto=format&fit=crop"
                  alt="Background"
                  className="
                    absolute inset-0
                    h-full w-full
                    object-cover
                    scale-110
                  "
                />

                {/* Overlay oscuro */}
                <div className="absolute inset-0 bg-black/65"></div>

                {/* Glow verde */}
                <div className="absolute inset-0 bg-gradient-to-tr from-[#27ae60]/40 to-transparent"></div>

                {/* Título */}
                <div className="relative z-10 flex h-full items-center justify-center p-5">

                  <span
                    className="
                      text-white
                      font-black
                      text-[15px]
                      tracking-[0.18em]
                      uppercase
                      text-center
                      drop-shadow-lg
                    "
                  >
                    {label}
                  </span>

                </div>
              </div>

              {/* ===================================================== */}
              {/* CONTENIDO */}
              {/* ===================================================== */}

              <div className="px-5 py-5 text-white flex-1 flex flex-col justify-between">

                <p className="text-[12px] text-white/90 leading-relaxed mb-5">
                  {desc}
                </p>

                {/* Indicadores decorativos */}
                <div className="flex gap-2 text-[10px] opacity-60 select-none">
                  ◔ ◔ ◔
                </div>

              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  </div>
</section>

      {/* ── SECCIÓN SEGURIDAD COMPACTA DE ACCESO ───── */}
      <section className="py-16 mx-auto max-w-[1100px] px-4">
        <h2 className="text-[36px] font-extrabold tracking-[-0.05em] text-[#27ae60] md:text-[46px]">Seguridad</h2>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          
          <article className="relative min-h-[190px] overflow-hidden bg-zinc-900 border border-zinc-800 text-white rounded-xl">
            <div className="relative z-10 p-6 flex flex-col justify-between h-full">
              <div>
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Restricciones</div>
                <h3 className="mt-2 text-[18px] font-bold leading-6">Acceso Corporativo Interno</h3>
                <p className="mt-2 text-[12px] leading-relaxed text-zinc-400">El ingreso está estrictamente reservado para aprendices, instructores y coordinadores vinculados al programa formativo ADSO.</p>
              </div>
            </div>
          </article>

          {/* Bloque interactivo */}
          <article 
            onClick={goToLogin}
            className="relative min-h-[190px] overflow-hidden bg-zinc-900 border border-zinc-800 text-white rounded-xl flex items-center justify-center cursor-pointer hover:border-zinc-700 hover:bg-zinc-900/80 transition-all group"
          >
            <div className="text-center p-6">
              <div className="text-[54px] font-black text-[#27ae60] leading-none mb-2 transition-transform group-hover:scale-110">➜</div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black">Ingresar Ahora</div>
            </div>
          </article>

        </div>
      </section>

      {/* ── CONTACTO MINIMALISTA ───────────────── */}
      <section id="contact" className="relative overflow-hidden bg-zinc-900 border-t border-zinc-800 py-16">
        <div className="absolute left-0 top-0 text-[#27ae60] text-[88px] font-black leading-none -translate-y-4 opacity-10 select-none pointer-events-none">∿∿∿</div>
        
        <div className="mx-auto max-w-[1100px] px-4">
          <div className="grid gap-8 md:grid-cols-[1.15fr_.85fr] md:items-start">
            
            {/* Formulario */}
            <div>
              <h2 className="text-[36px] font-extrabold tracking-[-0.05em] text-[#27ae60] md:text-[46px]">¿Tienes Dudas?</h2>
              <p className="mt-1 text-[12px] text-zinc-400">Comunícate con la mesa de administración técnica del sistema.</p>
              
              <form className="mt-8 space-y-6">
                <div>
                  <label className="mb-2 block text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black">Nombre del Instructor o Aprendiz</label>
                  <div className="h-[1px] bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800"></div>
                </div>
                <div>
                  <label className="mb-2 block text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black">Correo Electrónico MiSena</label>
                  <div className="h-[1px] bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800"></div>
                </div>
                <button 
                  type="button" 
                  onClick={goToLogin} 
                  className="grid h-11 w-24 place-items-center rounded-full bg-[#27ae60] text-white hover:bg-[#219653] transition-all shadow-md active:scale-95"
                >
                  ➜
                </button>
              </form>
            </div>

            {/* Detalles */}
            <div className="relative pt-8 md:pt-0 md:pl-6 text-[13px] text-zinc-400">
              <div className="absolute bottom-2 left-[22%] h-16 w-16 rounded-full border-2 border-zinc-800 opacity-50"></div>
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

      {/* ── FOOTER SÓLIDO EN VERDE CON COMPOSICIÓN LIMPIA ────────── */}
      <footer className="bg-[#27ae60] py-12 text-white">
        <div className="mx-auto max-w-[1100px] px-4">
          <div className="grid gap-8 md:grid-cols-[1.2fr_.8fr] md:items-end">
            
            {/* Branding */}
            <div>
              <div className="flex items-center gap-3">
                <div className="h-7 w-7 rounded-sm border-4 border-white border-r-transparent border-b-transparent"></div>
                <div className="text-[19px] font-extrabold tracking-[-0.04em] leading-tight">
                  KANBANA<br/>
                  <span className="text-[10px] font-light tracking-[0.25em] text-white/80">SENA ADSO</span>
                </div>
              </div>
              <p className="mt-4 max-w-[390px] text-[12px] leading-relaxed text-white/90 font-normal">
                Kanbana es una plataforma orientada a la planeación, control dinámico y despliegue estructurado de portafolios tecnológicos en ambientes formativos de desarrollo de software.
              </p>
            </div>

            {/* Enlaces */}
            <div className="md:text-right">
              <div className="flex flex-wrap gap-5 text-[12px] font-bold justify-start md:justify-end text-white/90">
                <a href="#about" className="hover:text-white transition-colors">Inicio</a>
                <a href="#features" className="hover:text-white transition-colors">Funcionalidades</a>
                <a href="#roles" className="hover:text-white transition-colors">Roles</a>
              </div>
              <div className="mt-4 flex gap-2 text-[12px] justify-start md:justify-end text-white/50 select-none">
                <span>Flow</span>
                <span>●</span>
                <span>●</span>
                <span>●</span>
              </div>
            </div>

          </div>
        </div>
      </footer>

      {/* ── LLAMADO AL COMPONENTE EXTERNO DEL LOGIN ASIDE ─────────────────────── 
      <LoginAside isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />*/}

    </div>
  );
};