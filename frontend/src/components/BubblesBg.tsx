/**
 * BubblesBg — fondo animado de burbujas flotantes
 * Se usa en las páginas de autenticación (login, register, forgot-password).
 * Las burbujas suben desde abajo con colores del sistema (blue, cyan, violet).
 */

const BUBBLES = [
  { w: 80,  left: '8%',  delay: 0,    dur: 12, color: 'rgba(37,99,235,0.13)'   },
  { w: 50,  left: '20%', delay: 3.5,  dur: 9,  color: 'rgba(96,165,250,0.11)'  },
  { w: 35,  left: '35%', delay: 6,    dur: 14, color: 'rgba(139,92,246,0.10)'  },
  { w: 60,  left: '50%', delay: 1.5,  dur: 11, color: 'rgba(34,211,238,0.12)'  },
  { w: 90,  left: '65%', delay: 4,    dur: 16, color: 'rgba(37,99,235,0.08)'   },
  { w: 45,  left: '78%', delay: 7,    dur: 10, color: 'rgba(96,165,250,0.12)'  },
  { w: 30,  left: '12%', delay: 9,    dur: 8,  color: 'rgba(34,211,238,0.10)'  },
  { w: 70,  left: '42%', delay: 2,    dur: 13, color: 'rgba(139,92,246,0.08)'  },
  { w: 55,  left: '88%', delay: 5,    dur: 15, color: 'rgba(37,99,235,0.10)'   },
  { w: 40,  left: '28%', delay: 8,    dur: 9,  color: 'rgba(96,165,250,0.09)'  },
  { w: 25,  left: '60%', delay: 0.8,  dur: 7,  color: 'rgba(139,92,246,0.12)'  },
  { w: 65,  left: '72%', delay: 11,   dur: 18, color: 'rgba(34,211,238,0.09)'  },
  { w: 38,  left: '5%',  delay: 4.5,  dur: 11, color: 'rgba(37,99,235,0.10)'   },
  { w: 48,  left: '55%', delay: 13,   dur: 14, color: 'rgba(96,165,250,0.08)'  },
  { w: 22,  left: '82%', delay: 2.5,  dur: 8,  color: 'rgba(139,92,246,0.11)'  },
];

export const BubblesBg = ({ className = '' }: { className?: string }) => (
  <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
    {BUBBLES.map((b, i) => (
      <div
        key={i}
        className="absolute rounded-full"
        style={{
          width:           b.w,
          height:          b.w,
          left:            b.left,
          bottom:          '-120px',
          background:      b.color,
          backdropFilter:  'blur(3px)',
          animation:       `bubble-rise ${b.dur}s ${b.delay}s ease-in infinite`,
          border:          '1px solid rgba(255,255,255,0.06)',
        }}
      />
    ))}
  </div>
);
