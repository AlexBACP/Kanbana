import { useEffect } from 'react';
import { useAuthStore } from '../store/auth.store';

export const ThemeApplier = () => {
  const { settings } = useAuthStore();

  useEffect(() => {
    // Apply theme color as data-theme attribute on body
    document.documentElement.setAttribute('data-theme', settings.themeColor);
  }, [settings.themeColor]);

  return null;
};
