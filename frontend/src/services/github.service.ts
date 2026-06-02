import api from './api';

/**
 * githubService — cliente de la integración GitHub.
 *
 * Cadena de uso:
 *   1. getStatus()        → ¿el usuario tiene GitHub vinculado?
 *   2. connect()          → URL OAuth (el navegador redirige allí)
 *   3. listUserRepos()    → repos del usuario para elegir cuál vincular
 *   4. linkRepo()         → vincula repo al proyecto + registra webhook
 *   5. (GitHub → webhook) → mueve tickets automáticamente
 *   6. getTicketActivity()→ commits/ramas/PRs enlazados al ticket
 *   7. getProjectMetrics()→ métricas DevOps del proyecto
 */
export const githubService = {
  // ── Cuenta / OAuth ──────────────────────────────────────────────────────
  getStatus: () =>
    api.get('/github/status').then(r => r.data),

  /** Devuelve la URL de autorización; el caller hace window.location = url */
  connect: () =>
    api.get('/github/connect').then(r => r.data as { url: string }),

  disconnect: () =>
    api.delete('/github/disconnect').then(r => r.data),

  // ── Repositorios ──────────────────────────────────────────────────────────
  listUserRepos: () =>
    api.get('/github/repos').then(r => r.data),

  getProjectRepos: (proyectoId: number) =>
    api.get(`/github/projects/${proyectoId}/repos`).then(r => r.data),

  linkRepo: (proyectoId: number, full_name: string) =>
    api.post(`/github/projects/${proyectoId}/repos`, { full_name }).then(r => r.data),

  unlinkRepo: (repoId: number) =>
    api.delete(`/github/repos/${repoId}`).then(r => r.data),

  // ── Actividad y métricas ────────────────────────────────────────────────
  getTicketActivity: (ticketId: number) =>
    api.get(`/github/tickets/${ticketId}/activity`).then(r => r.data),

  getProjectMetrics: (proyectoId: number) =>
    api.get(`/github/projects/${proyectoId}/metrics`).then(r => r.data),
};
