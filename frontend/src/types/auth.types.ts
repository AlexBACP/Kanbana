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
    rol: 'coordinador' | 'instructor' | 'aprendiz'; // 'lider_tecnico' no existe como rol — es sub-rol via es_lider_tecnico
    activo: boolean;
    creado_en: string;
  };
  tokens: AuthTokens;
}