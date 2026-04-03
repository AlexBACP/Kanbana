export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface AuthResponse {
  user: {
    id: number;
    nombre: string;
    correo: string;
    rol: 'coordinador' | 'instructor' | 'lider_tecnico' | 'aprendiz';
    activo: boolean;
    creado_en: string;
  };
  tokens: AuthTokens;
}