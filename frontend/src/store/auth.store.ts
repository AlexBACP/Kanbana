import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types/user.types';

export type ThemeColor = 'violet' | 'blue' | 'emerald' | 'rose' | 'amber' | 'cyan';
export type ThemeMode  = 'dark' | 'light' | 'dim';

export interface AppSettings {
  themeColor: ThemeColor;
  themeMode:  ThemeMode;
  sidebarCompact: boolean;
  notificationsEnabled: boolean;
  animationsEnabled: boolean;
  language: 'es' | 'en';
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  settings: AppSettings;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  clearUser: () => void;
  setLoading: (loading: boolean) => void;
  updateUser: (partial: Partial<User>) => void;
  updateSettings: (partial: Partial<AppSettings>) => void;
}

const defaultSettings: AppSettings = {
  themeColor: 'blue',
  themeMode:  'dark',
  sidebarCompact: false,
  notificationsEnabled: true,
  animationsEnabled: true,
  language: 'es',
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      // CLAVE: arranca en TRUE para que ProtectedRoute espere a AuthInit
      // antes de decidir si redirigir o no. Sin esto hay un flash de /login.
      isLoading: true,
      settings: defaultSettings,

      setUser: (user) =>
        set({ user, isAuthenticated: true, isLoading: false }),

      setToken: (token) => {
        localStorage.setItem('access_token', token);
        set({ token });
      },

      clearUser: () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        set({ user: null, token: null, isAuthenticated: false, isLoading: false });
      },

      setLoading: (loading) => set({ isLoading: loading }),

      updateUser: (partial) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...partial } : null,
        })),

      updateSettings: (partial) =>
        set((state) => ({
          settings: { ...state.settings, ...partial },
        })),
    }),
    {
      name: 'auth-storage',
      // isLoading NUNCA se persiste — si se cierra mientras carga, al reabrir arranca en true
      // y AuthInit lo resolverá en <500ms
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        settings: state.settings,
      }),
      // Al rehidratar desde localStorage, siempre forzar isLoading=true
      // para que AuthInit valide el token con el backend antes de continuar
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isLoading = true;
        }
      },
    }
  )
);
