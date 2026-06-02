export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Primario: Índigo neutro (profesional, no "claude-purple")
        primary: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        // Superficies oscuras tipo Jira dark
        surface: {
          bg:      '#0d1117',   // Fondo base (casi negro)
          card:    '#161b22',   // Tarjetas
          elevated:'#1c2128',   // Modales, dropdowns
          border:  '#30363d',   // Bordes
          hover:   '#21262d',   // Hover states
        },
        // Texto
        ink: {
          primary:   '#e6edf3',  // Texto principal
          secondary: '#8b949e',  // Texto secundario
          muted:     '#484f58',  // Texto desactivado
          accent:    '#79c0ff',  // Links / accent
        },
        // Semánticos
        success: { DEFAULT: '#3fb950', light: '#1a3a1f', border: '#238636' },
        warning: { DEFAULT: '#d29922', light: '#3a2e00', border: '#9e6a03' },
        danger:  { DEFAULT: '#f85149', light: '#3a1a1a', border: '#da3633' },
        info:    { DEFAULT: '#79c0ff', light: '#0d2238', border: '#1f6feb' },
        // Backward compat con clases dark-* que ya usa el proyecto
        dark: {
          bg:     '#0d1117',
          card:   '#161b22',
          border: '#30363d',
          text:   '#e6edf3',
          muted:  '#8b949e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'xl':  '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          from: { opacity: '0', transform: 'translateX(-8px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in':  'fade-in 0.2s ease-out',
        'slide-in': 'slide-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
};
