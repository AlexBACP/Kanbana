export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          400: '#818cf8',
          500: '#8b5cf6',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        dark: {
          bg: '#0f172a',      // Fondo principal (Slate 900)
          card: '#1e293b',    // Fondo de tarjetas (Slate 800)
          border: '#334155',  // Bordes (Slate 700)
          text: '#f8fafc',    // Texto principal (Slate 50)
          muted: '#94a3b8',   // Texto secundario (Slate 400)
        }
      },
    },
  },
  plugins: [],
}