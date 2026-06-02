import { useEffect } from 'react';
import { useAuthStore } from '../store/auth.store';

export const ThemeApplier = () => {
  const { settings } = useAuthStore();

  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute('data-theme', settings.themeColor);
    html.setAttribute('data-mode',  settings.themeMode ?? 'dark');

    // Tailwind dark mode class
    if (settings.themeMode === 'light') {
      html.classList.remove('dark', 'dim');
      html.classList.add('light');
    } else if (settings.themeMode === 'dim') {
      html.classList.remove('light');
      html.classList.add('dark', 'dim');
    } else {
      html.classList.remove('light', 'dim');
      html.classList.add('dark');
    }
  }, [settings.themeColor, settings.themeMode]);

  // ── Animaciones globales ──────────────────────────────────────────────
  // Cuando el usuario desactiva animaciones, añadimos la clase no-animations
  // que mata transitions/animations vía CSS (ver index.css).
  useEffect(() => {
    const html = document.documentElement;
    if (settings.animationsEnabled === false) {
      html.classList.add('no-animations');
    } else {
      html.classList.remove('no-animations');
    }
  }, [settings.animationsEnabled]);

  return null;
};
