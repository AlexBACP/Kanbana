/**
 * WelcomeTour — Tour interactivo de bienvenida estilo Figma.
 *
 * Se muestra automáticamente la primera vez que un usuario entra a la
 * plataforma (tour_completado=false en BD). Resalta elementos reales de
 * la UI con tooltips explicativos.
 *
 * El tour es específico por ROL. En esta fase 1 solo está implementado
 * para APRENDIZ; los otros roles ven el modal de bienvenida básico.
 *
 * Se monta en App.tsx para tener acceso a cualquier ruta.
 */
import { useState, useEffect } from 'react';
import Joyride, { CallBackProps, Step, STATUS } from 'react-joyride';
import { useAuthStore } from '../store/auth.store';
import { userService } from '../services/user.service';

// ── Estilos comunes del tour — coherente con el tema oscuro de Kanbana ──────
const joyrideStyles = {
  options: {
    primaryColor:     '#3b82f6',   // azul Kanbana
    backgroundColor:  '#18181b',   // zinc-900
    textColor:        '#e4e4e7',   // zinc-200
    arrowColor:       '#18181b',
    overlayColor:     'rgba(9, 9, 11, 0.75)',
    zIndex:           10000,
  },
  buttonNext: {
    backgroundColor: '#3b82f6',
    color:           '#ffffff',
    fontSize:        '13px',
    fontWeight:      900,
    borderRadius:    '8px',
    padding:         '8px 18px',
  },
  buttonBack: {
    color:      '#a1a1aa',
    fontSize:   '13px',
    fontWeight: 700,
    marginRight: '8px',
  },
  buttonSkip: {
    color:      '#71717a',
    fontSize:   '12px',
    fontWeight: 700,
  },
  buttonClose: {
    color:    '#71717a',
    padding:  '4px',
  },
  tooltip: {
    borderRadius:  '12px',
    border:        '1px solid #3f3f46',
    padding:       '20px',
    fontSize:      '14px',
    lineHeight:    1.55,
  },
  tooltipTitle: {
    fontSize:     '16px',
    fontWeight:   900,
    color:        '#3b82f6',
    marginBottom: '6px',
  },
  tooltipContent: {
    padding:    '0',
    fontSize:   '13px',
    color:      '#d4d4d8',
  },
};

// ── PASOS DEL TOUR — APRENDIZ ───────────────────────────────────────────────
const APRENDIZ_STEPS: Step[] = [
  {
    target: 'body',
    placement: 'center',
    title: '👋 ¡Bienvenido a Kanbana!',
    content: (
      <div>
        <p>Te voy a mostrar los lugares clave del sistema en menos de 1 minuto.</p>
        <p className="mt-2 text-zinc-400 text-[12px]">Puedes saltarlo y volver a verlo cuando quieras desde tu perfil.</p>
      </div>
    ),
    disableBeacon: true,
  },
  {
    target: '.kanbana-sidebar',
    title: '🧭 Tu menú lateral',
    content: 'Acá tienes todo lo que necesitas: tablero de tareas, recursos del proyecto y notificaciones.',
    placement: 'right',
  },
  {
    target: '#topbar-bell',
    title: '🔔 Notificaciones',
    content: 'Te avisamos en tiempo real cuando tu líder o instructor revisa tu trabajo, te asigna tareas o comenta.',
    placement: 'bottom',
  },
  {
    target: 'body',
    placement: 'center',
    title: '🎯 El código KAN-XXXXX',
    content: (
      <div>
        <p>Cada tarea tiene un <strong className="text-blue-400 font-mono">código único</strong> tipo <strong>KAN-58329</strong>.</p>
        <p className="mt-2">Cuando hagas commits en GitHub, escribe el código en el mensaje. Ejemplo:</p>
        <code className="block mt-2 p-2 bg-zinc-950 border border-zinc-800 rounded text-blue-400 text-[12px]">
          git commit -m "KAN-58329 implementa login"
        </code>
        <p className="mt-2 text-zinc-400 text-[12px]">Kanbana detecta el código y mueve la tarea automáticamente. ✨</p>
      </div>
    ),
  },
  {
    target: 'body',
    placement: 'center',
    title: '💬 KanbanaAI te ayuda',
    content: (
      <div>
        <p>Tenemos un asistente IA flotante en la esquina inferior derecha.</p>
        <p className="mt-2">Pregúntale lo que sea: cómo hacer algo, qué significa tal palabra, o ayuda con tus tareas.</p>
      </div>
    ),
  },
  {
    target: 'body',
    placement: 'center',
    title: '🚀 ¡Estás listo!',
    content: (
      <div>
        <p>Ya conoces lo básico. Cualquier duda, KanbanaAI está acá para ti.</p>
        <p className="mt-3 text-zinc-400 text-[12px]">Puedes volver a ver este tour desde <strong className="text-zinc-200">Perfil → Ver tutorial</strong>.</p>
      </div>
    ),
  },
];

// ── PASOS — INSTRUCTOR/COORDINADOR (versión simplificada en Fase 1) ────────
const ADMIN_STEPS: Step[] = [
  {
    target: 'body',
    placement: 'center',
    title: '👋 Bienvenido a Kanbana',
    content: (
      <div>
        <p>Como <strong className="text-cyan-400">instructor/coordinador</strong> tienes acceso al panel completo de gestión.</p>
        <p className="mt-2">Desde aquí gestionas fichas, proyectos, módulos y usuarios.</p>
      </div>
    ),
    disableBeacon: true,
  },
  {
    target: '.kanbana-sidebar',
    title: '🧭 Tu panel',
    content: 'Navega entre proyectos, fichas, usuarios y notificaciones desde el menú lateral.',
    placement: 'right',
  },
  {
    target: '#topbar-bell',
    title: '🔔 Solicitudes en tiempo real',
    content: 'Las solicitudes de vinculación de aprendices, permisos del líder técnico y revisiones llegan aquí.',
    placement: 'bottom',
  },
  {
    target: 'body',
    placement: 'center',
    title: '🎯 ¡Listo!',
    content: 'Cualquier duda, puedes volver a ver el tour desde tu perfil.',
  },
];

interface Props {
  /** Si es true, fuerza el tour aunque ya esté completado. Usado desde el botón "Ver tutorial". */
  forced?: boolean;
  /** Llamado cuando el tour termina (completado o saltado). Solo útil cuando forced=true. */
  onClose?: () => void;
}

export const WelcomeTour = ({ forced = false, onClose }: Props) => {
  const { user, updateUser } = useAuthStore() as any;
  const [run, setRun] = useState(false);

  // Decide si arrancar el tour
  useEffect(() => {
    if (!user) return;

    // Si es forzado desde un botón → arrancar siempre
    if (forced) { setRun(true); return; }

    // Si ya lo completó, no hacer nada
    if (user.tour_completado === true) return;

    // Si está en una ruta de auth/landing, esperar a estar en dashboard
    const path = window.location.pathname;
    if (path === '/' || path.startsWith('/auth') || path.startsWith('/confirmar')) return;
    if (path.startsWith('/solicitar-vinculacion')) return; // aprendiz aún sin ficha

    // Pequeño delay para que la UI termine de montar (sidebar, topbar)
    const t = setTimeout(() => setRun(true), 800);
    return () => clearTimeout(t);
  }, [user, forced]);

  // Elegir los pasos según el rol
  const esAprendiz = user?.rol === 'aprendiz';
  const steps = esAprendiz ? APRENDIZ_STEPS : ADMIN_STEPS;

  const handleCallback = async (data: CallBackProps) => {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      // Guardar en BD que ya lo completó
      try {
        await userService.setTourCompletado(true);
        // Actualizar el store local para que no se vuelva a mostrar este sesión
        if (updateUser) updateUser({ tour_completado: true });
      } catch (err) {
        console.warn('[WelcomeTour] No se pudo guardar tour_completado:', err);
      }
      if (onClose) onClose();
    }
  };

  if (!user) return null;
  // Aprendiz sin ficha: no mostrar nada hasta que esté vinculado
  if (esAprendiz && !user.fichaId && !forced) return null;

  return (
    <Joyride
      run={run}
      steps={steps}
      callback={handleCallback}
      continuous
      showProgress
      showSkipButton
      hideCloseButton={false}
      disableOverlayClose
      locale={{
        back:  'Anterior',
        close: 'Cerrar',
        last:  'Empezar',
        next:  'Siguiente',
        skip:  'Saltar tour',
        open:  'Abrir',
      }}
      styles={joyrideStyles}
    />
  );
};
