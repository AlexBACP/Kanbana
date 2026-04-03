import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 1. Definición de interfaces (Asegúrate de que coincidan con tu base de datos)
export type ThemeColor = 'violet' | 'blue' | 'emerald' | 'rose' | 'amber';

export interface User {
  id: string;
  email: string;
  nombre: string;
  rol: 'admin' | 'coordinador' | 'instructor' | 'aprendiz';
  avatar?: string;
}

export interface AppSettings {
  themeColor: ThemeColor;
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
  themeColor: 'violet',
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
      isLoading: false, 
      settings: defaultSettings,

      // Acción para establecer usuario y marcar como autenticado
      setUser: (user) =>
        set({ 
          user, 
          isAuthenticated: true, 
          isLoading: false 
        }),

      // Acción para el token
      setToken: (token) => {
        // CORRECCIÓN: El store persistido ya guarda el token, 
        // pero mantenerlo en localStorage manual es útil para Axios.
        localStorage.setItem('access_token', token);
        set({ token });
      },

      // Acción para limpiar sesión (Logout)
      clearUser: () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        set({ 
          user: null, 
          token: null, 
          isAuthenticated: false, 
          isLoading: false 
        });
      },

      setLoading: (loading) => set({ isLoading: loading }),

      // Actualización parcial del usuario
      updateUser: (partial) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...partial } : null,
        })),

      // Actualización parcial de configuración
      updateSettings: (partial) =>
        set((state) => ({
          settings: { ...state.settings, ...partial },
        })),
    }),
    {
      name: 'auth-storage',
      // ✅ CAMBIO CLAVE: Excluimos 'isLoading' de la persistencia.
      // Esto evita que si la app se cierra cargando, se quede trabada al abrirla.
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        settings: state.settings,
      }),
    }
  )
);