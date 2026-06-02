import api from './api';

export interface SearchHit {
  type: 'proyecto' | 'modulo' | 'tarea' | 'ficha' | 'usuario';
  id: number;
  label: string;
  subtitle?: string;
  path?: string;
  section?: string;
  meta?: Record<string, string | number | boolean>;
}

export const searchService = {
  search: (q: string): Promise<SearchHit[]> =>
    api.get('/search', { params: { q } }).then(r => r.data),
};
