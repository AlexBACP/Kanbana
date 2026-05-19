import type { Slide } from '../landing.types';

export const carouselSlides: Slide[] = [
  {
    role: 'Coordinador',
    badge: 'bg-emerald-500/10 text-emerald-400',
    title: 'Resumen global del centro',
    subtitle: 'Visión completa de fichas, proyectos y usuarios del programa.',
    stats: [
      ['8', 'Proyectos activos'],
      ['24', 'Tickets abiertos'],
      ['47', 'Completados'],
      ['3', 'Bloqueados'],
    ],
    sideLabel: 'Administración',
    sideItems: ['Panel de control', 'Proyectos', 'Fichas SENA', 'Usuarios', 'Líderes técnicos'],
    activeItemIndex: 0,
    body: (
      <>
        <div className="md-row">
          <div className="md-row-top">
            <span className="md-row-name">Sistema de inventarios ADSO</span>
            <span className="md-badge" style={{ background: 'var(--accent-ghost)', color: 'var(--accent-bright)' }}>
              Activo
            </span>
          </div>
          <div className="md-bar">
            <i style={{ width: '72%' }} />
          </div>
        </div>

        <div className="md-row">
          <div className="md-row-top">
            <span className="md-row-name">Portal de aprendices SENA</span>
            <span className="md-badge" style={{ background: 'rgba(224,163,46,0.12)', color: '#e0a32e' }}>
              En pausa
            </span>
          </div>
          <div className="md-bar">
            <i style={{ width: '41%' }} />
          </div>
        </div>

        <div className="md-row">
          <div className="md-row-top">
            <span className="md-row-name">App de gestión académica</span>
            <span className="md-badge" style={{ background: 'var(--accent-ghost)', color: 'var(--accent-bright)' }}>
              Activo
            </span>
          </div>
          <div className="md-bar">
            <i style={{ width: '88%' }} />
          </div>
        </div>
      </>
    ),
  },
  {
    role: 'Instructor',
    badge: 'bg-blue-500/10 text-blue-400',
    title: 'Estado de tus fichas y proyectos',
    subtitle: 'Seguimiento de los proyectos de las fichas que supervisas.',
    stats: [
      ['3', 'Fichas asignadas'],
      ['5', 'Proyectos'],
      ['28', 'Aprendices'],
      ['61%', 'Avance medio'],
    ],
    sideLabel: 'Gestión',
    sideItems: ['Panel de control', 'Mis proyectos', 'Mis fichas', 'Aprendices'],
    activeItemIndex: 0,
    body: (
      <>
        <div className="md-row">
          <div className="md-row-top">
            <span className="md-row-name">Ficha 2879654 · Análisis y Desarrollo</span>
            <span className="md-badge" style={{ background: 'var(--accent-ghost)', color: 'var(--accent-bright)' }}>
              3 proyectos
            </span>
          </div>
          <div className="md-bar">
            <i style={{ width: '64%' }} />
          </div>
        </div>

        <div className="md-row">
          <div className="md-row-top">
            <span className="md-row-name">Ficha 2901133 · ADSO Nocturna</span>
            <span className="md-badge" style={{ background: 'var(--accent-ghost)', color: 'var(--accent-bright)' }}>
              2 proyectos
            </span>
          </div>
          <div className="md-bar">
            <i style={{ width: '53%' }} />
          </div>
        </div>

        <div className="md-listrow">
          <div className="md-av" />
          <span className="nm">Laura Giraldo</span>
          <span className="rl">Líder técnico</span>
        </div>

        <div className="md-listrow">
          <div className="md-av" />
          <span className="nm">Andrés Patiño</span>
          <span className="rl">Aprendiz</span>
        </div>
      </>
    ),
  },
  {
    role: 'Líder técnico',
    badge: 'bg-emerald-500/10 text-emerald-400',
    title: 'Progreso de tu equipo',
    subtitle: 'Backlog, sprints y tablero del proyecto que lideras.',
    stats: [
      ['3', 'Por hacer'],
      ['2', 'En curso'],
      ['1', 'Testing'],
      ['4', 'Hecho'],
    ],
    sideLabel: 'Mi espacio',
    sideItems: ['Panel de control', 'Mi proyecto', 'Mi equipo'],
    activeItemIndex: 0,
    body: (
      <div className="md-cols">
        <div className="md-col">
          <div className="md-col-h">
            <span>Por hacer</span>
            <span>3</span>
          </div>
          <div className="md-card">
            <div className="t">Modelo entidad-relación</div>
            <div className="m">
              <span className="md-tag" style={{ background: 'rgba(224,163,46,0.14)', color: '#e0a32e' }}>
                Media
              </span>
              <div className="md-av" />
            </div>
          </div>
          <div className="md-card">
            <div className="t">Mockups del módulo de login</div>
            <div className="m">
              <span className="md-tag" style={{ background: 'rgba(95,101,110,0.2)', color: 'var(--txt-2)' }}>
                Baja
              </span>
              <div className="md-av" />
            </div>
          </div>
        </div>

        <div className="md-col">
          <div className="md-col-h">
            <span>En curso</span>
            <span>2</span>
          </div>
          <div className="md-card">
            <div className="t">API de autenticación JWT</div>
            <div className="m">
              <span className="md-tag" style={{ background: 'rgba(240,77,77,0.14)', color: '#f04d4d' }}>
                Alta
              </span>
              <div className="md-av" />
            </div>
          </div>
        </div>

        <div className="md-col">
          <div className="md-col-h">
            <span>Testing</span>
            <span>1</span>
          </div>
          <div className="md-card">
            <div className="t">CRUD de tickets</div>
            <div className="m">
              <span className="md-tag" style={{ background: 'rgba(224,163,46,0.14)', color: '#e0a32e' }}>
                Media
              </span>
              <div className="md-av" />
            </div>
          </div>
        </div>

        <div className="md-col">
          <div className="md-col-h">
            <span>Hecho</span>
            <span>4</span>
          </div>
          <div className="md-card">
            <div className="t">Documento IEEE-830</div>
            <div className="m">
              <span className="md-tag" style={{ background: 'var(--accent-ghost)', color: 'var(--accent-bright)' }}>
                ✓ Adj.
              </span>
              <div className="md-av" />
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    role: 'Aprendiz',
    badge: 'bg-amber-500/10 text-amber-400',
    title: 'Tus tareas y avance',
    subtitle: 'El tablero personal con los tickets que tu líder te asignó.',
    stats: [
      ['6', 'Completados'],
      ['2', 'En progreso'],
      ['3', 'Pendientes'],
      ['11', 'Total'],
    ],
    sideLabel: 'Mi espacio',
    sideItems: ['Mi tablero', 'Mis tickets', 'Notificaciones'],
    activeItemIndex: 0,
    body: (
      <>
        <div className="md-row">
          <div className="md-row-top">
            <span className="md-row-name">#42 · Validar formulario de registro</span>
            <span className="md-badge" style={{ background: 'rgba(124,160,255,0.14)', color: '#79c0ff' }}>
              En progreso
            </span>
          </div>
          <div className="md-bar">
            <i style={{ width: '55%' }} />
          </div>
        </div>

        <div className="md-listrow">
          <div className="md-av" />
          <span className="nm">#39 · Maquetar vista de perfil</span>
          <span className="rl" style={{ color: 'var(--accent-bright)' }}>
            ✓ Hecho
          </span>
        </div>

        <div className="md-listrow">
          <div className="md-av" />
          <span className="nm">#45 · Subir evidencia de pruebas</span>
          <span className="rl" style={{ color: '#e0a32e' }}>
            Vence en 2d
          </span>
        </div>
      </>
    ),
  },
];