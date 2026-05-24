/**
 * KanbanaLogo — Logo animado reutilizable
 *
 * El ícono tiene un fondo oscuro azul con órbitas SVG y planetas
 * que giran a distintas velocidades. El "K" pulsa suavemente en color.
 *
 * Props:
 *   size        — tamaño del ícono en px (default 44)
 *   withText    — mostrar "Kanbana" + subtitle al lado (default false)
 *   subtitle    — texto debajo de "Kanbana" (default "SENA · ADSO")
 *   textClass   — clases extra para "Kanbana"
 *   subClass    — clases extra para el subtitle
 *   iconBorder  — clase de borde/ring extra alrededor del ícono
 *
 * Funciona sobre fondos: blanco (navbar), oscuro (paneles), azul (footer).
 */
interface KanbanaLogoProps {
  size?:       number;
  withText?:   boolean;
  subtitle?:   string | null;
  textClass?:  string;
  subClass?:   string;
  iconBorder?: string;
}

export const KanbanaLogo = ({
  size       = 44,
  withText   = false,
  subtitle   = 'SENA · ADSO',
  textClass  = '',
  subClass   = '',
  iconBorder = '',
}: KanbanaLogoProps) => {
  const r        = size / 2;          // radio del viewBox lógico relativo
  const fontSize = size * 0.36;       // tamaño del K relativo al ícono
  const radius   = Math.round(size * 0.22);  // border-radius proporcional

  return (
    <div className="flex items-center gap-3">
      {/* ── Ícono ─────────────────────────────────────────────────────── */}
      <div
        className={`relative shrink-0 flex items-center justify-center ${iconBorder}`}
        style={{
          width:        size,
          height:       size,
          borderRadius: radius,
          background:   'radial-gradient(circle at 35% 35%, #1e3a8a 0%, #060d1f 100%)',
          boxShadow:    '0 0 0 1px rgba(59,130,246,0.25), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        {/* SVG órbitas + planetas */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 28 28"
          style={{ overflow: 'visible' }}
        >
          {/* Órbita exterior — anillo discontinuo azul */}
          <circle
            cx="14" cy="14" r="12"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="0.5"
            strokeDasharray="3 5"
            opacity="0.55"
            style={{
              transformOrigin: '14px 14px',
              animation: 'spin 22s linear infinite',
            }}
          />
          {/* Órbita interior — anillo sólido */}
          <circle
            cx="14" cy="14" r="8"
            fill="none"
            stroke="#1d4ed8"
            strokeWidth="0.6"
            opacity="0.35"
          />
          {/* Planeta 1 — top (cian) */}
          <circle
            cx="14" cy="2.2" r="1.9"
            fill="#22d3ee"
            opacity="0.92"
            style={{
              transformOrigin: '14px 14px',
              animation: 'spin 12s linear infinite',
            }}
          />
          {/* Planeta 2 — derecha (ámbar) */}
          <circle
            cx="25.8" cy="14" r="1.4"
            fill="#fbbf24"
            opacity="0.85"
            style={{
              transformOrigin: '14px 14px',
              animation: 'spin 20s linear infinite reverse',
            }}
          />
          {/* Planeta 3 — abajo (rosa) */}
          <circle
            cx="14" cy="25.8" r="1.1"
            fill="#fb7185"
            opacity="0.78"
            style={{
              transformOrigin: '14px 14px',
              animation: 'spin 8s linear infinite',
            }}
          />
        </svg>

        {/* K central */}
        <span
          className="relative z-10 select-none logo-k"
          style={{
            fontFamily:             'Georgia, "Times New Roman", serif',
            fontSize,
            fontWeight:             900,
            lineHeight:             1,
            background:             'linear-gradient(135deg, #93c5fd 0%, #2563eb 100%)',
            WebkitBackgroundClip:   'text',
            WebkitTextFillColor:    'transparent',
          }}
        >K</span>
      </div>

      {/* ── Texto (opcional) ──────────────────────────────────────────── */}
      {withText && (
        <div className="flex flex-col leading-snug">
          <span className={`font-extrabold tracking-tight ${textClass}`}>
            Kanbana
          </span>
          {subtitle && (
            <span className={`text-[10px] font-semibold tracking-[0.18em] uppercase ${subClass}`}>
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
