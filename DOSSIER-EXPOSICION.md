# 📘 Dossier de Exposición — Kanbana

> Documento maestro para presentar y defender el proyecto.
> Generado escaneando el código real. Úsalo como guía y "chuleta" para responder cualquier pregunta.

---

## 1. Visión general

**Kanbana** es una herramienta de gestión tipo Kanban para el **SENA**, pensada para que instructores y aprendices gestionen proyectos formativos siguiendo el ciclo de vida del software (SDLC), organizados por **fichas → trimestres → módulos (sprints) → tareas (tickets)**.

### Roles del sistema

| Rol                       | Qué puede hacer                                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Coordinador**     | Acceso total: fichas, proyectos, usuarios, líderes                                                        |
| **Instructor**      | Gestiona sus fichas y proyectos, aprueba aprendices                                                        |
| **Aprendiz**        | Trabaja en su proyecto (tareas)                                                                            |
| **Líder técnico** | *Sub-rol* de aprendiz (`es_lider_tecnico=true`): gestiona el tablero, equipo y módulos de su proyecto |

> ⚠️ Dato clave para preguntas: **"líder técnico" NO es un rol de base en la BD**. Es un aprendiz con el campo `es_lider_tecnico = true`. Esto evita duplicar la lógica de permisos.

---

## 2. Stack tecnológico (qué uso y por qué)

### Frontend

| Tecnología                             | Para qué                                                    |
| --------------------------------------- | ------------------------------------------------------------ |
| **React 18 + TypeScript**         | Librería UI + tipado estático                              |
| **Vite**                          | Bundler / dev server con HMR                                 |
| **TailwindCSS**                   | Estilos utility-first (tema zinc/oscuro)                     |
| **TanStack Query (React Query)**  | Cache y sincronización de datos del servidor                |
| **Zustand**                       | Estado global de cliente (sesión, settings, notificaciones) |
| **React Router DOM 7**            | Enrutamiento SPA                                             |
| **React Hook Form**               | Formularios                                                  |
| **Framer Motion**                 | Animaciones                                                  |
| **@dnd-kit**                      | Drag & drop del tablero Kanban                               |
| **socket.io-client**              | Notificaciones en tiempo real                                |
| **lucide-react**                  | Iconos                                                       |
| **react-big-calendar + date-fns** | Calendario                                                   |
| **xlsx**                          | Lectura de Excel (preview de importación de aprendices)     |

### Backend

| Tecnología                              | Para qué                                                |
| ---------------------------------------- | -------------------------------------------------------- |
| **NestJS 11**                      | Framework backend (módulos, inyección de dependencias) |
| **TypeORM + MySQL 2**              | ORM + base de datos relacional                           |
| **Passport + JWT**                 | Autenticación (access + refresh tokens)                 |
| **Socket.io (@nestjs/websockets)** | WebSockets para notificaciones                           |
| **nodemailer**                     | Envío de correos (SMTP)                                 |
| **imapflow + mailparser**          | Lectura de rebotes de correo (IMAP)                      |
| **otplib + qrcode**                | Autenticación de dos factores (2FA / TOTP)              |
| **bcrypt**                         | Hash de contraseñas                                     |
| **multer**                         | Subida de archivos (avatares, banners, adjuntos)         |
| **xlsx**                           | Importación masiva de aprendices desde Excel            |
| **axios**                          | Llamadas HTTP a APIs externas (GitHub, Google, Gemini)   |
| **@nestjs/schedule**               | Tareas programadas (cron: recordatorios, rebotes)        |
| **ioredis**                        | Cliente Redis                                            |

### Infraestructura

- **Docker + Docker Compose** (WSL2): contenedores para `mysql`, `redis`, `backend` (NestJS, puerto 3000), `frontend` (Vite, puerto 5173) y `n8n` (automatización, puerto 5678).
- Hot-reload vía bind mounts.

---

## 3. Arquitectura (cómo se conecta todo)

```
┌─────────────┐     HTTP/REST (axios)      ┌──────────────┐     TypeORM      ┌─────────┐
│  Navegador  │ ───────────────────────►   │   Backend    │ ───────────────► │  MySQL  │
│  React/Vite │ ◄───────────────────────   │   NestJS     │ ◄─────────────── │         │
│  :5173      │     WebSocket (socket.io)   │   :3000/api  │                  └─────────┘
└─────────────┘ ◄═══════════════════════►   └──────┬───────┘
                                                    │
                       APIs externas ───────────────┼──────────────┐
                       • GitHub API/OAuth/Webhooks   │  • SMTP (nodemailer)
                       • Google OAuth                │  • IMAP (imapflow)
                       • Gemini 2.5 Flash (IA)       │  • Redis
                       • n8n (automatización) ◄══════┘  (webhook ↔ REST)
```

- Todas las peticiones del frontend pasan por una instancia de **axios** (`services/api.ts`) con interceptores que inyectan el JWT y renuevan el token al expirar (401 → refresh).
- El backend expone todo bajo el prefijo **`/api`**.

---

## 4. Catálogo de módulos backend (16 módulos NestJS)

Cada módulo agrupa un Controller (rutas), un Service (lógica) y, si aplica, Entidades (tablas).

| Módulo                 | Responsabilidad                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| **auth**          | Login, registro, JWT, refresh, 2FA (TOTP), OAuth Google y GitHub                             |
| **users**         | CRUD de usuarios, perfiles, avatares, contraseñas, vinculación de aprendices               |
| **fichas**        | Fichas SENA, trimestres, importación de aprendices (individual + Excel), validación MX     |
| **projects**      | Proyectos, sprints/módulos, trimestres, sugerencias de módulos (IA), flujo de revisión    |
| **tickets**       | Tareas: CRUD, estados, asignación, mover entre módulos, flujo aprendiz↔líder↔instructor |
| **comments**      | Comentarios en tareas                                                                        |
| **recursos**      | Recursos del proyecto (links: GitHub, Drive, Figma…)                                        |
| **github**        | Integración real GitHub: OAuth, vincular repos, webhooks, commits→tareas, métricas DevOps |
| **notifications** | Notificaciones in-app + emisión por WebSocket                                               |
| **email**         | Correos transaccionales (SMTP), crons de recordatorios, lector de rebotes (IMAP)             |
| **dashboard**     | Estadísticas agregadas por rol                                                              |
| **permisos**      | Permisos temporales (líder solicita gestionar)                                              |
| **chat**          | Asistente "KanbanaAI" (Gemini 2.5 Flash / Ollama local)                                      |
| **search**        | Búsqueda universal filtrada por rol                                                         |
| **integrations**  | Integración con n8n: resumen diario (entrante) + eventos salientes                          |
| **app**           | Módulo raíz + health check                                                                 |

**Totales:** 16 módulos · 16 controllers · 20 services · 17 entidades.

---

## 5. Inventario de APIs

### 5.1 APIs internas (REST propias) — ~157 endpoints

Conteo exacto de endpoints por módulo (decoradores `@Get/@Post/@Patch/@Delete`):

| Módulo            | Endpoints                      |
| ------------------ | ------------------------------ |
| projects           | 39                             |
| users              | 26                             |
| fichas             | 25                             |
| tickets            | 17                             |
| auth               | 16                             |
| github             | 11                             |
| recursos           | 6                              |
| permisos           | 5                              |
| notifications      | 4                              |
| comments           | 3                              |
| integrations (n8n) | 3                              |
| search             | 1                              |
| chat               | 1                              |
| dashboard          | 1                              |
| bounce-checker     | 1                              |
| app (health)       | 1                              |
| **TOTAL**    | **≈160 endpoints REST** |

> 💡 Si preguntan **"¿cuántas APIs tienes?"**: *"Expongo una API REST propia con ~160 endpoints agrupados en 16 módulos, y consumo varias APIs externas."*

### 5.2 APIs / servicios externos que consumo (8)

| Servicio externo                    | Para qué                                                             | Dónde                                                        |
| ----------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------- |
| **GitHub API**                | OAuth, listar/vincular repos, crear webhooks, leer commits/PRs        | `github/github.service.ts`, `github-auth.service.ts`      |
| **Google OAuth**              | Login con Google                                                      | `auth/auth.service.ts`                                      |
| **Gemini 2.5 Flash** (Google) | IA: asistente KanbanaAI + sugerencias de módulos                     | `chat/chat.service.ts`, `projects/sugerencias.service.ts` |
| **Ollama** (local, opcional)  | IA alternativa local si no hay Gemini                                 | `chat/chat.service.ts`                                      |
| **SMTP** (Gmail)              | Envío de correos transaccionales                                     | `email/email.service.ts`                                    |
| **IMAP** (Gmail)              | Lectura de rebotes de correo                                          | `email/bounce-checker.service.ts`                           |
| **WebSocket (Socket.io)**     | Notificaciones en tiempo real                                         | gateway de notifications                                      |
| **n8n** (automatización)     | Resumen diario por cron + eventos salientes a Telegram/Discord/correo | `integrations/n8n.service.ts`                               |

---

## 6. Modelo de datos (17 entidades / tablas)

```
Ficha (fichas)
 ├─ codigo, programa, tipo_formacion, jornada, instructor_id
 ├──< Trimestre (trimestres)   [1 ficha → N trimestres]
 │     └─ numero, tipo (documental/desarrollo), fechas, esta_finalizado
 └──< User (usuarios)          [1 ficha → N aprendices]

Project (proyectos)
 ├─ nombre, estado, instructorId, liderId, fichaId
 ├──< Sprint (sprints)         [módulos del proyecto, ligados a un trimestre]
 │     └─ nombre, esta_activo, esta_finalizado, trimestre_id
 ├──< Ticket (tickets)
 │     ├─ titulo, estado (to_do/in_progress/testing/done), prioridad
 │     ├─ asignado_a_id, sprint_id, fecha_limite, hora_limite
 │     ├──< Comment (comentarios)
 │     └──< TicketAttachment (ticket_attachments)
 ├──< ProyectoRecurso (proyecto_recursos)   [links: github, drive, figma…]
 └──< SugerenciaModulo (sugerencias_modulo) [propuestas IA]

User (usuarios)
 ├─ nombre, correo, rol, es_lider_tecnico, documento
 ├─ google_id, github_login_id, password_set
 ├─ vinculacion_estado, ficha_solicitada_id, jornada_solicitada
 ├─ totp_secret, totp_enabled (2FA)
 └─ avatar_url, banner_url

GitHub (integración)
 ├─ GithubAccount (cuenta vinculada + token cifrado)
 ├─ Repository (repos vinculados a proyectos)
 ├─ GitBranch, GitCommit, GitPullRequest
 └─ WebhookEvent (eventos recibidos, idempotencia)

Otras: Notification (notificaciones), PermisoTemporal (permisos_temporales)
```

---

## 7. Catálogo del frontend

### Páginas (15) — `frontend/src/pages/`

`LandingPage` · `AuthCallbackPage` · `ForgotPasswordPage` · `ResetPasswordPage` · `ConfirmarCuentaPage` · `SolicitarVinculacionPage` · `ProjectPage` · `TrimestreDetailPage` · `TrimestreKanbanPage` · `KanbanPage` · `BacklogPage` · `TicketDetailPage` · `ProfilePage` · `CalendarPage` · `NotFoundPage`

### Dashboards / layouts

- `AdminDashboard` — shell único para coordinador, instructor y líder (renderiza paneles según el rol).
- Paneles: `Overview`, `ProjectsPanel`, `FichasPanel`, `UsersPanel`, `LeadersPanel`, `TareasPanel`, `MiEquipoPanel`, `NotificationsPanel`, `SettingsPanel`, + dashboards de Aprendiz/Líder/Instructor.

### Componentes clave (40 en total) — `frontend/src/components/`

`Sidebar` · `TopBar` (búsqueda universal) · `KanbanBoard` + `KanbanColumn` + `TicketCard` (drag & drop) · `Avatar` (foto/iniciales) · `LoginAside` (login+registro) · `GithubRepoPanel` · `GitHubWidget` · `MiContextoCard` · `SolicitudesPendientesPanel` · `ExcelAprendicesPreview` · `DateTimeInput` · `TwoFactorModal` · `ChatBubble` (KanbanaAI) · `NotificationToast` · `ThemeApplier` · etc.

### Capa de servicios (14) — `frontend/src/services/`

Una por dominio (`auth`, `user`, `ficha`, `project`, `ticket`, `github`, `notification`, `comment`, `recurso`, `permisos`, `dashboard`, `chat`, `search`) + `api.ts` (axios base con JWT + auto-refresh).

### Estado global (Zustand, 3 stores) — `frontend/src/store/`

`auth.store` (sesión + settings/tema) · `notification.store` · `chat.store`.

---

## 8. Flujos clave ("¿cómo funciona X?") + dónde está el código

### 🔐 Autenticación

- **Login normal:** `POST /api/auth/login` → valida con bcrypt → emite JWT (access 15 min + refresh). *(auth.service.ts)*
- **2FA:** si `totp_enabled`, pide código TOTP (otplib). *(TwoFactorModal.tsx, auth.service.ts)*
- **OAuth Google/GitHub:** `/api/auth/google` y `/api/auth/github` → callback → `/auth/callback?tokens` → `AuthCallbackPage`.
- **Guard de rutas:** `ProtectedRoute.tsx` (frontend) + `AuthGuard('jwt')` + `JwtStrategy` (backend).

### 🎫 Ciclo de vida de una tarea (ticket)

`to_do → in_progress → testing → done`

- Aprendiz toma/mueve hasta `in_progress`; líder aprueba hasta `testing`; instructor finaliza (`done`).
- Tablero drag & drop: `KanbanBoard.tsx` → `PATCH /api/tickets/:id/status`. *(tickets.service.ts valida permisos por rol)*

### 🔗 Integración GitHub (commits mueven tareas)

1. Usuario conecta su cuenta (OAuth) en Configuración.
2. Vincula un repo a un proyecto (`GithubRepoPanel`).
3. Webhook → `POST /api/github/webhook`:
   - `push` con `KAN-32`/`#32` en el commit → mueve tarea 32 a **in_progress**.
   - PR abierto → **testing**; PR mergeado → **done**.
     *(github.service.ts: processPush/processPullRequest; github.refs.ts: parseTicketRefs)*

### 👥 Vinculación de aprendices auto-registrados

1. Aprendiz se registra → si no tiene ficha, va a `SolicitarVinculacionPage` (código + jornada + documento).
2. Backend valida jornada y crea solicitud `pendiente` → notifica al instructor.
3. Instructor aprueba/rechaza en `SolicitudesPendientesPanel` → correo de confirmación.
   *(users.service.ts: solicitarVinculacion / aprobarVinculacion)*

### 📧 Correos y rebotes

- Envío: `EmailService` (SMTP) — invitaciones, confirmaciones, notificaciones.
- **Validación preventiva:** `POST /api/fichas/validar-correos` chequea MX del dominio antes de importar.
- **Captura de rebotes:** `BounceCheckerService` lee la bandeja IMAP (cron cada 15 min) y marca correos rebotados.

### 🤖 KanbanaAI (asistente IA)

- `ChatBubble.tsx` → `POST /api/chat` → `chat.service.ts` → Gemini 2.5 Flash (o Ollama local) con el contexto del proyecto.

### 🔍 Búsqueda universal

- `TopBar.tsx` → `GET /api/search?q=` → resultados filtrados por rol (proyectos, módulos, fichas, tareas, usuarios).

### 🔌 Automatización con n8n (bidireccional)

- **Saliente (Kanbana → n8n):** cada notificación interna se emite como evento a un webhook de n8n. *(notifications.service.ts → n8n.service.ts `emit()`)*
- **Entrante (n8n → Kanbana):** n8n corre por cron y llama `GET /api/integrations/n8n/resumen-diario` (protegido por API key `x-n8n-key`) → arma y envía el resumen de tareas pendientes/vencidas al instructor. *(integrations.controller.ts, n8n.service.ts `buildResumenDiario()`)*
- n8n corre como su propio contenedor (puerto 5678) en la red Docker. Guía completa: `N8N-INTEGRACION.md`.

---

## 9. Integración n8n — Automatizaciones detalladas

> n8n es una herramienta de automatización de flujos open-source (como Zapier pero self-hosted).
> Corre en `http://localhost:5678`. Usuario: `admin` / Contraseña: `kanbana2026`.
> Desde los workflows, llega al backend con `http://backend:3000/api`.

### ¿Qué se implementó en el código?

**Backend (`backend/src/integrations/`):**

| Archivo | Qué hace |
|---|---|
| `n8n.service.ts` | `emit()` fire-and-forget hacia n8n + `buildResumenDiario()` |
| `n8n-api-key.guard.ts` | Protege los endpoints con cabecera `x-n8n-key` |
| `integrations.controller.ts` | 3 endpoints: resumen-diario, status, test |

**Endpoints disponibles para n8n:**
```
GET  /api/integrations/n8n/resumen-diario   → datos del digest diario
GET  /api/integrations/n8n/status           → estado de la integración
POST /api/integrations/n8n/test             → dispara evento de prueba
```

**Variables de entorno necesarias:**
```env
N8N_WEBHOOK_URL=http://n8n:5678/webhook/kanbana-eventos  # saliente
N8N_API_KEY=una-clave-secreta                             # entrante
```

---

### Automatización 1 — Resumen diario al instructor (n8n → Kanbana)

**¿Qué hace?** Cada mañana a las 7:00 AM (hora Colombia), n8n consulta la API de Kanbana y envía un correo/mensaje al instructor con sus tareas pendientes y vencidas.

**Flujo:**
```
[Schedule Trigger] 7:00 AM cron
         │
         ▼
[HTTP Request] GET http://backend:3000/api/integrations/n8n/resumen-diario
               Header: x-n8n-key: tu_clave
         │
         ▼ Respuesta JSON:
{
  "resumenes": [{
    "instructor": { "nombre": "Marta", "correo": "marta@sena.edu.co" },
    "ficha": "2826503",
    "total_pendientes": 7,
    "vencidas": [{ "titulo": "API de citas", "fecha_limite": "2025-05-28" }],
    "proximas_24h": []
  }]
}
         │
         ▼
[Split Out] → un item por instructor
         │
         ▼
[Send Email / Telegram] → correo con lista de tareas
```

**Nodos en n8n:** Schedule Trigger → HTTP Request → Split Out → Send Email

---

### Automatización 2 — Alertas en tiempo real (Kanbana → n8n)

**¿Qué hace?** Cuando ocurre cualquier evento en Kanbana (nueva notificación, tarea enviada a revisión, aprendiz vinculado, etc.), Kanbana dispara un POST al webhook de n8n que puede reenviar el aviso a Telegram, Discord, Slack o cualquier canal.

**Flujo:**
```
Evento en Kanbana (ej: tarea enviada a revisión)
         │
         ▼
NotificationsService.create()
         │
         ▼
N8nService.emit('notificacion.creada', { titulo, mensaje, tipo, usuario_id })
         │  POST http://n8n:5678/webhook/kanbana-eventos
         ▼
[Webhook Trigger] en n8n recibe:
{
  "evento": "notificacion.creada",
  "datos": {
    "titulo": "Tarea enviada a revisión: API de citas",
    "mensaje": "Diego finalizó la tarea. Revísala.",
    "tipo": "success",
    "usuario_id": 5
  },
  "origen": "kanbana"
}
         │
         ▼
[Switch] por campo "evento"
  ├─ notificacion.creada → [Telegram] mensaje al instructor
  ├─ test               → [Telegram] mensaje de prueba
  └─ otros              → [Discord] log general
```

**Nodos en n8n:** Webhook → Switch → Telegram/Discord/Slack

---

### Eventos que Kanbana envía a n8n

| Evento | Cuándo se dispara |
|---|---|
| `notificacion.creada` | Cada vez que se crea una notificación interna |
| `test` | Al llamar `POST /api/integrations/n8n/test` |

> 💡 Se pueden añadir más eventos fácilmente llamando `this.gateway.emit('nombre', datos)` desde cualquier servicio.

---

### Cómo probar sin configurar n8n

```bash
# Ver estado de la integración
curl http://localhost:3000/api/integrations/n8n/status \
  -H "x-n8n-key: tu_clave"

# Ver el JSON del resumen diario
curl http://localhost:3000/api/integrations/n8n/resumen-diario \
  -H "x-n8n-key: tu_clave"

# Disparar evento de prueba hacia n8n
curl -X POST http://localhost:3000/api/integrations/n8n/test \
  -H "x-n8n-key: tu_clave"
```

---

## 10. Banco de preguntas frecuentes (para el jurado)

**P: ¿Cuántas APIs usas?**
R: Una API REST propia con ~160 endpoints en 16 módulos, y consumo 8 servicios externos (GitHub, Google OAuth, Gemini, Ollama, SMTP, IMAP, WebSockets y n8n).

**P: ¿Qué es n8n y cómo lo integraste?**
R: Una herramienta de automatización de flujos (open-source, self-hosted). La integración es bidireccional: Kanbana le envía eventos por webhook y n8n consume por cron mi endpoint de resumen diario (con API key) para enviar al instructor sus tareas pendientes/vencidas por correo o chat. Corre en su propio contenedor Docker.

**P: ¿Qué base de datos y cómo modelaste los datos?**
R: MySQL con TypeORM, 17 entidades. La jerarquía es Ficha → Trimestre/Usuarios, Proyecto → Sprint → Ticket, más las tablas de GitHub y notificaciones.

**P: ¿Cómo manejas la autenticación y seguridad?**
R: JWT (access + refresh) con Passport, contraseñas con bcrypt, 2FA opcional con TOTP, OAuth con Google y GitHub, y guards por rol en cada endpoint.

**P: ¿Cómo se comunican frontend y backend?**
R: REST sobre HTTP con axios (con auto-refresh de token) y WebSockets (Socket.io) para notificaciones en tiempo real.

**P: ¿Qué tiene de "inteligente"?**
R: Un asistente con IA (Gemini 2.5 Flash) y sugerencias automáticas de módulos según el contexto del proyecto y la plantilla SDLC.

**P: ¿Cómo se integra con GitHub?**
R: OAuth para conectar la cuenta, vinculación de repos, y webhooks que detectan commits/PRs y mueven las tareas automáticamente, además de métricas DevOps.

**P: ¿Cómo está desplegado / cómo corre?**
R: Docker Compose con 4 contenedores (MySQL, Redis, backend NestJS, frontend Vite) sobre WSL2.

---

## 11. Números clave (resumen para memorizar)

| Métrica                      | Valor          |
| ----------------------------- | -------------- |
| Módulos backend              | 16             |
| Endpoints REST propios        | ~160           |
| Servicios externos consumidos | 8              |
| Entidades / tablas            | 17             |
| Páginas frontend             | 15             |
| Componentes React             | 40             |
| Services frontend             | 14             |
| Stores (Zustand)              | 3              |
| Roles                         | 3 (+1 sub-rol) |
| Contenedores Docker           | 5              |

---

## 12. Manejo de errores — try/catch (cómo, dónde y para qué)

> **Concepto clave:** en Kanbana el `try/catch` no se usa para "atrapar cualquier error".
> Tiene un propósito específico en cada contexto. Hay **4 patrones distintos** a lo largo del código.

---

### Patrón 1 — Operaciones secundarias que NO deben tumbar la operación principal

**Dónde:** `tickets.service.ts → create()`, `users.service.ts`, `projects.service.ts`

**Regla:** la tarea/usuario/proyecto **ya fue guardado** en la BD. Si el correo o la notificación fallan, no tiene sentido devolver un error 500 al cliente — la operación principal fue exitosa.

```typescript
// La tarea ya se guardó (saved). Ahora intentamos notificar.
try {
  await this.notificationsService.create({ ... });
  await this.emailService.notificarTareaAsignada({ ... });
} catch (err) {
  // Solo logueamos — no relanzamos. El ticket fue creado exitosamente.
  console.error('[TicketsService.create] Error enviando notificación:', err?.message);
}
```

> 💡 **Para responder al jurado:** *"Si el servidor de correo cae, la tarea sigue creándose. El try/catch aísla los canales de comunicación de la lógica de negocio."*

---

### Patrón 2 — Fire-and-forget hacia servicios externos

**Dónde:** `n8n.service.ts → emit()`, `github.service.ts → webhook`

**Regla:** Kanbana dispara un evento a n8n o a GitHub. Si esos servicios no responden, **no es un error crítico** para el usuario. Se loguea y se sigue.

```typescript
// Emitir evento a n8n — si n8n está caído, Kanbana sigue funcionando.
try {
  await fetch(url, { method: 'POST', body: JSON.stringify(payload) });
  this.logger.debug(`→ n8n evento '${evento}' emitido`);
} catch (err: any) {
  this.logger.warn(`No se pudo emitir '${evento}' a n8n: ${err?.message}`);
  // NO relanzamos → nunca llega como 500 al cliente
}
```

> 💡 **Para responder al jurado:** *"Si n8n se cae, ningún usuario de Kanbana lo nota. El try/catch es el contrato que dice: este servicio es opcional."*

---

### Patrón 3 — Catch con relanzamiento (errores que SÍ deben parar la operación)

**Dónde:** `github.service.ts → vincularRepo()`, `auth.service.ts → googleCallback()`

**Regla:** si no podemos acceder al repositorio de GitHub o verificar el token de Google, **sí** queremos devolver un error claro al usuario (400/401), no silenciarlo.

```typescript
// Verificar acceso al repo antes de vincularlo.
try {
  repoData = (await gh.get(`/repos/${owner}/${name}`)).data;
} catch (err: any) {
  // Relanzamos con un mensaje legible → llega al cliente como 400
  throw new BadRequestException(
    `No se pudo acceder al repositorio: ${err?.response?.data?.message}`
  );
}
```

```typescript
// Verificar firma del state de OAuth — si falla, es un ataque o token expirado.
try {
  const [nonce, ts, sig] = Buffer.from(state, 'base64url').toString().split('.');
  return sig === expected && (Date.now() - Number(ts)) < 10 * 60 * 1000;
} catch {
  return false; // Estado malformado → se rechaza silenciosamente
}
```

> 💡 **Para responder al jurado:** *"Aquí el catch no silencia — transforma el error técnico en un mensaje legible para el usuario o en un false que el flujo de auth interpreta como rechazo."*

---

### Patrón 4 — Cron jobs: catch en la consulta para no romper todo el ciclo

**Dónde:** `email-cron.service.ts → recordatoriosPlazo()`, `notificarModulosVencidos()`

**Regla:** el cron corre automáticamente cada día. Si la consulta a la BD falla, el catch hace un `return` temprano para **no crashear el proceso NestJS completo** y loguea el error para diagnóstico.

```typescript
@Cron('0 13 * * *', { timeZone: 'America/Bogota' })
async recordatoriosPlazo() {
  let tickets: Ticket[];
  try {
    tickets = await this.ticketsRepo.find({ where: { ... } });
  } catch (err: any) {
    this.logger.error(`Error al consultar tickets: ${err.message}`);
    return; // salida temprana — el cron falla silenciosamente sin tumbar el servidor
  }

  // Por cada ticket, también envolvemos el envío individual:
  for (const ticket of tickets) {
    try {
      await this.emailService.notificarRecordatorioPlazo({ ... });
    } catch (err: any) {
      this.logger.error(`No se pudo enviar recordatorio para ticket ${ticket.id}`);
      // Continuamos con el siguiente — un fallo individual no cancela los demás
    }
  }
}
```

> 💡 **Para responder al jurado:** *"El cron tiene dos niveles de try/catch: uno que protege toda la ejecución y otro dentro del bucle para que un error en un correo no cancele los demás."*

---

### Patrón 5 — Try/catch de una sola línea (cleanup silencioso)

**Dónde:** `bounce-checker.service.ts`

Para cerrar conexiones IMAP al finalizar, independiente de si hubo error:

```typescript
try { await client.logout(); } catch { /* no op */ }
```

> Siempre intentamos hacer logout limpio. Si la conexión ya estaba rota, no importa.

---

### Resumen visual de los 5 patrones

| Patrón                               | ¿Relanza?     | ¿Loguea? | Caso típico                        |
| ------------------------------------- | -------------- | --------- | ----------------------------------- |
| **1** Operación secundaria     | ❌ No          | ✅ Sí    | Email/notificación post-guardado   |
| **2** Fire-and-forget externo   | ❌ No          | ✅ Warn   | Eventos a n8n / webhooks opcionales |
| **3** Error crítico al usuario | ✅ Sí (throw) | ❌ No     | GitHub API, OAuth, validaciones     |
| **4** Cron job                  | ❌ No (return) | ✅ Error  | Recordatorios diarios, rebotes      |
| **5** Cleanup de una línea     | ❌ No          | ❌ No     | Cierre de conexiones IMAP           |

**Total de bloques try/catch en el proyecto:** ~65 backend · ~31 frontend = **~96 en total**.

---

## 13. Protección de rutas (frontend + backend)

> Kanbana tiene **dos capas de protección independientes**: una en el frontend (qué URL puedes visitar) y otra en el backend (qué endpoints puedes llamar). Un usuario malicioso que salte la primera capa igual encuentra la segunda.

---

### Capa 1 — Frontend: `ProtectedRoute` (React Router)

Componente que envuelve las rutas en `App.tsx`. Antes de renderizar la página, verifica:

1. **¿Está autenticado?** — Si no hay token/sesión → redirige a `/` (login).
2. **¿Tiene el rol correcto?** — Si el rol no está en `allowedRoles` → redirige a su dashboard.
3. **¿Es aprendiz sin ficha?** — Si `fichaId === null` → redirige a `/solicitar-vinculacion`.
4. **¿Es líder técnico?** — Props especiales: `allowLiderTecnico` (permite acceso aunque no tenga el rol) y `denyLiderTecnico` (bloquea el acceso a líderes, p.ej. para que no vean `/kanban` simple).

**Cómo están organizadas las rutas en `App.tsx`:**

```tsx
// Rutas que solo requieren estar logueado (cualquier rol)
<Route element={<ProtectedRoute />}>
  <Route path="/tickets/:id" element={<TicketDetailPage />} />
  <Route path="/profile/:id" element={<ProfilePage />} />
</Route>

// Rutas solo para coordinador/instructor (+ líderes técnicos)
<Route element={<ProtectedRoute allowedRoles={['coordinador', 'instructor']} allowLiderTecnico />}>
  <Route path="/projects/:id/backlog" element={<BacklogPage />} />
  <Route path="/projects/:id/kanban" element={<KanbanPage />} />
</Route>

// Rutas solo para aprendiz (sin líderes técnicos — tienen su propio dashboard)
<Route element={<ProtectedRoute allowedRoles={['aprendiz']} denyLiderTecnico />}>
  <Route path="/kanban" element={<TrimestreKanbanPage />} />
</Route>
```

**Archivo:** `frontend/src/components/ProtectedRoute.tsx`

---

### Capa 2 — Backend: Guards de NestJS

Dos tipos de guard protegen los endpoints:

#### A) `AuthGuard('jwt')` — Passport JWT (el principal)

Verifica que la petición traiga un JWT válido en el header `Authorization: Bearer <token>`.

- Aplicado a **nivel de clase** en casi todos los controllers → **todas las rutas del módulo quedan protegidas**:

```typescript
@UseGuards(AuthGuard('jwt'))
@Controller('tickets')
export class TicketsController { ... }
```

- Aplicado a **nivel de método** en github (el webhook es público, el resto protegido):

```typescript
@Post('webhook')          // sin guard — GitHub llama aquí sin JWT
handleWebhook() { ... }

@UseGuards(AuthGuard('jwt'))
@Get('repos')             // este sí requiere JWT
getRepos() { ... }
```

El único controller sin guard es `AppController` (el health check `/api`), que es público por diseño.

#### B) `N8nApiKeyGuard` — API Key custom

Para los endpoints que consume n8n (que no es un usuario con JWT). Verifica la cabecera `x-n8n-key`:

```typescript
@UseGuards(N8nApiKeyGuard)
@Controller('integrations/n8n')
export class IntegrationsController { ... }
```

**Archivo:** `backend/src/integrations/n8n-api-key.guard.ts`

---

### Capa 3 — Backend: `JwtStrategy` (valida el token en profundidad)

No es un guard sino la **estrategia** que Passport ejecuta cuando el guard pasa el token. Hace dos verificaciones adicionales:

```typescript
async validate(payload: any) {
  const user = await this.usersService.findOne(payload.sub);
  // 1. El usuario existe en la BD (no fue eliminado después de emitir el token)
  // 2. El usuario está activo (no fue suspendido)
  if (!user || !user.activo) {
    throw new UnauthorizedException('Token inválido o usuario inactivo');
  }
  // Quita la contraseña del objeto que llega a los controllers como req.user
  const { contrasena, ...result } = user as any;
  return result;
}
```

> 💡 Un token puede ser criptográficamente válido pero el usuario puede haber sido desactivado — `JwtStrategy` cubre ese caso que el guard solo no cubriría.

**Archivo:** `backend/src/auth/jwt.strategy.ts`

---

### Capa 4 — Backend: Validación de rol en el servicio

Después del guard, muchos servicios hacen una segunda verificación de **permisos finos** (no solo autenticación sino autorización):

```typescript
// Solo el instructor de ESTE proyecto puede gestionar sus repos
if (user.rol !== 'instructor' || project.instructorId !== user.id) {
  throw new ForbiddenException('Solo el instructor de este proyecto puede gestionar sus repositorios.');
}

// Solo el líder técnico puede enviar su módulo a revisión
if (project.liderId !== user.id) {
  throw new ForbiddenException('Solo el líder técnico del proyecto puede enviar el módulo a revisión.');
}
```

Esto evita que un instructor acceda a los proyectos de otro instructor aunque ambos tengan el mismo rol.

---

### Capa 5 — Frontend: Interceptor axios (auto-refresh de tokens)

El `access_token` dura **15 minutos**. El interceptor en `api.ts` maneja la renovación automática:

```
Petición → 401 Unauthorized
  → ¿Hay refresh_token en localStorage?
      Sí → POST /api/auth/refresh → nuevo access_token
           → reintentar la petición original con el nuevo token
      No  → limpiar sesión → redirigir al login
```

El usuario **nunca nota** que el token expiró — la petición se reintenta transparentemente.

**Archivo:** `frontend/src/services/api.ts`

---

### Resumen de las 5 capas

```
Usuario intenta acceder a una URL o endpoint
         │
         ▼
[1] ProtectedRoute (React)  → ¿logueado? ¿rol correcto? ¿ficha asignada?
         │ pasa
         ▼
[2] AuthGuard / N8nApiKeyGuard (NestJS)  → ¿JWT válido? ¿API key correcta?
         │ pasa
         ▼
[3] JwtStrategy.validate()  → ¿usuario existe y está activo en la BD?
         │ pasa
         ▼
[4] Lógica del servicio  → ¿tiene permiso sobre ESTE recurso específico?
         │
         ▼
      Respuesta
```

**Y transversalmente:**

```
[5] Interceptor axios  → renueva el token en silencio al detectar 401
```

**Pregunta típica del jurado:** *"¿Qué pasa si alguien escribe directamente la URL `/projects/5/kanban` sin estar logueado?"*
→ `ProtectedRoute` lo detecta antes de renderizar y lo manda al login, guardando la URL como `?redirect=` para redirigirlo ahí después de iniciar sesión.

---

## 14. Catálogo de librerías (qué son, para qué y dónde)

### 🔵 Backend — dependencias de producción

| Librería                                       | Versión | Para qué                                                                         | Dónde en Kanbana                                                                    |
| ----------------------------------------------- | -------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `@nestjs/common` / `core`                   | 11       | Framework principal: módulos, controllers, servicios, inyección de dependencias | Todo el backend — base del proyecto                                                 |
| `@nestjs/jwt`                                 | 11       | Generar y verificar JWT (access + refresh tokens)                                 | `auth.service.ts` — `login()`, `refreshToken()`                               |
| `@nestjs/passport`                            | 11       | Integrar estrategias de autenticación (JWT, local) con NestJS                    | `auth.module.ts`, guards en todos los controllers                                  |
| `@nestjs/typeorm`                             | 11       | Puente entre NestJS y TypeORM — inyectar repositorios con `@InjectRepository`  | Todos los módulos con acceso a BD                                                   |
| `@nestjs/websockets` + `platform-socket.io` | 11       | WebSockets en NestJS para notificaciones en tiempo real                           | Gateway de notificaciones                                                            |
| `@nestjs/schedule`                            | 6        | Cron jobs con el decorador `@Cron(...)`                                         | `email-cron.service.ts` — recordatorios diarios y rebotes                         |
| `@nestjs/swagger`                             | 11       | Genera la documentación de la API en `/api/docs` automáticamente              | `main.ts`, decoradores `@ApiTags` en controllers                                 |
| `@nestjs/config`                              | 4        | Carga variables de entorno del `.env` con `process.env.*`                     | `app.module.ts`, todos los servicios que leen env vars                             |
| `typeorm`                                     | 0.3      | ORM para mapear clases TypeScript a tablas MySQL                                  | Todas las entidades (`*.entity.ts`) y repositorios                                 |
| `mysql2`                                      | 3        | Driver de MySQL — TypeORM lo usa internamente para conectar con la BD            | Configuración en `app.module.ts`                                                  |
| `passport` + `passport-jwt`                 | 0.7 / 4  | Estrategia JWT: extrae el token del header, lo verifica y popula `req.user`     | `jwt.strategy.ts`                                                                  |
| `passport-local`                              | 1        | Estrategia de login con email + contraseña                                       | `local.strategy.ts` (login clásico)                                               |
| `bcrypt`                                      | 6        | Hash seguro de contraseñas (saltRounds = 10)                                     | `users.service.ts` — crear y verificar contraseñas                               |
| `axios`                                       | 1        | Cliente HTTP para llamar a APIs externas desde el backend                         | GitHub API, Google OAuth, Gemini (peticiones nativas)                                |
| `nodemailer`                                  | 8        | Envío de correos transaccionales por SMTP                                        | `email.service.ts` — invitaciones, confirmaciones, recordatorios                  |
| `imapflow`                                    | 1.3      | Leer la bandeja de entrada por IMAP (protocolo de correo entrante)                | `bounce-checker.service.ts` — detectar correos rebotados                          |
| `mailparser`                                  | 3        | Parsear los correos IMAP a objetos JS legibles                                    | `bounce-checker.service.ts` — junto con imapflow                                  |
| `multer`                                      | 2        | Manejo de subida de archivos (`multipart/form-data`)                            | Avatares/banners (`users.controller.ts`), adjuntos de tickets, Excel de aprendices |
| `xlsx`                                        | 0.18     | Leer y parsear archivos Excel (.xlsx) en el servidor                              | `fichas.service.ts` — importación masiva de aprendices                           |
| `otplib`                                      | 13       | Generar y verificar códigos TOTP para 2FA (Google Authenticator)                 | `auth.service.ts` — `setup2FA()`, `verify2FA()`                               |
| `qrcode`                                      | 1.5      | Generar el QR que el usuario escanea para activar 2FA                             | `auth.service.ts` — `setup2FA()` devuelve un QR en base64                       |
| `ioredis`                                     | 5        | Cliente Redis — caché y potencial de colas                                      | Configurado en el stack, disponible para sesiones y caché                           |
| `socket.io`                                   | 4        | Servidor WebSocket — emite notificaciones a los clientes en tiempo real          | Gateway de notificaciones                                                            |
| `class-validator`                             | 0.15     | Valida DTOs con decoradores (`@IsString`, `@IsEmail`…)                       | `chat-message.dto.ts` y DTOs de entrada                                            |
| `class-transformer`                           | 0.5      | Transforma objetos planos a instancias de clase (usado con class-validator)       | Junto con `ValidationPipe` en `main.ts`                                          |
| `rxjs`                                        | 7        | Programación reactiva — requerida por el core de NestJS                         | Internamente por NestJS                                                              |
| `reflect-metadata`                            | 0.2      | Habilita los decoradores de TypeScript en tiempo de ejecución                    | Requerido por NestJS + TypeORM para que funcionen los decoradores                    |

---

### 🟢 Frontend — dependencias de producción

| Librería                                        | Versión | Para qué                                                                   | Dónde en Kanbana                                                                                            |
| ------------------------------------------------ | -------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `react` + `react-dom`                        | 18.3     | Librería UI principal — componentes, hooks, ciclo de vida                 | Toda la app                                                                                                  |
| `react-router-dom`                             | 7        | Enrutamiento SPA: rutas, navegación,`useParams`, `useNavigate`         | `App.tsx` — define todas las rutas; `ProtectedRoute.tsx`                                                |
| `@tanstack/react-query`                        | 5        | Cache y sincronización de datos del servidor:`useQuery`, `useMutation` | Todas las páginas y paneles — reemplaza useState+useEffect para fetching                                   |
| `zustand`                                      | 5        | Estado global del cliente (stores ligeros)                                  | `auth.store.ts` (sesión + settings), `notification.store.ts`, `chat.store.ts`                         |
| `axios`                                        | 1        | Cliente HTTP con interceptores JWT + auto-refresh                           | `services/api.ts` — base de todos los servicios del frontend                                              |
| `@dnd-kit/core` + `sortable` + `utilities` | 6/10/3   | Drag & drop accesible para el tablero Kanban                                | `KanbanBoard.tsx`, `KanbanColumn.tsx`, `TicketCard.tsx`                                                |
| `framer-motion`                                | 12       | Animaciones fluidas de entrada/salida de componentes                        | `Sidebar.tsx`, `ChatBubble.tsx`, `NotificationToast.tsx`, `SearchModal.tsx`, `TwoFactorModal.tsx`  |
| `react-hook-form`                              | 7        | Formularios con validación, sin re-renders innecesarios                    | `LoginAside.tsx`, `BacklogPage.tsx`, `ProfilePage.tsx`, `UsersPanel.tsx`, `ForgotPasswordPage.tsx` |
| `socket.io-client`                             | 4        | Conexión WebSocket al backend para notificaciones en tiempo real           | `App.tsx` + `hooks/useSocket.ts`                                                                         |
| `lucide-react`                                 | 0.577    | Librería de iconos SVG como componentes React                              | En casi todos los componentes y páginas                                                                     |
| `react-big-calendar`                           | 1.19     | Componente de calendario mensual/semanal                                    | `CalendarPage.tsx` — vista de tareas por fecha                                                            |
| `date-fns`                                     | 4        | Utilidades para formatear y manipular fechas                                | `CalendarPage.tsx`, dashboards de Overview e InstructorOverview                                            |
| `xlsx`                                         | 0.18     | Leer archivos Excel en el navegador para preview antes de importar          | `ExcelAprendicesPreview.tsx` — parsea el .xlsx sin enviarlo al servidor todavía                          |
| `tailwindcss`                                  | 3.4      | Framework CSS utility-first — estilos de toda la app                       | Clases en todos los componentes (no hay CSS externo)                                                         |

---

### 🔧 Herramientas de desarrollo (no van a producción)

| Herramienta                           | Para qué                                                     |
| ------------------------------------- | ------------------------------------------------------------- |
| `typescript` (5.7 back / 5.9 front) | Tipado estático — detecta errores antes de ejecutar         |
| `vite` (8)                          | Bundler del frontend con HMR instantáneo en desarrollo       |
| `@vitejs/plugin-react`              | Plugin de Vite para soporte de JSX y React Fast Refresh       |
| `eslint` + plugins                  | Linter — detecta problemas de código en tiempo de escritura |
| `prettier`                          | Formateador de código automático                            |
| `postcss` + `autoprefixer`        | Procesa el CSS de Tailwind y añade prefijos de navegador     |
| `ts-node`                           | Ejecuta TypeScript directamente (usado por NestJS CLI en dev) |
| `jest` + `ts-jest`                | Framework de tests unitarios del backend                      |
| `@nestjs/testing`                   | Utilidades para testear módulos NestJS en aislamiento        |
| `@nestjs/cli`                       | CLI para generar módulos, controllers y servicios NestJS     |

---

### Pregunta típica: *"¿Para qué usas axios si fetch ya existe en el navegador?"*

Axios en el **frontend** tiene dos ventajas clave sobre `fetch` nativo:

1. Los **interceptores** — permiten inyectar el JWT en cada petición y renovarlo automáticamente al recibir 401, sin repetir esa lógica en cada llamada.
2. Manejo automático de errores HTTP (fetch no lanza error en 4xx/5xx, axios sí).

Axios en el **backend** se usa solo para llamar a APIs externas (GitHub, Google, Gemini). Para las llamadas a Gemini se usa `fetch` nativo de Node 18 porque Anthropic/Google recomienda HTTP puro sin wrapper.

---

## 15. Caso de uso narrado (para contar en la exposición)

> Historia de extremo a extremo que recorre las funciones reales de Kanbana. Sirve para explicar el *para qué* de la app sin tecnicismos.

### Personajes

- **Instructora Marta** — instructora de la ficha *2826503 - ADSO*.
- **Carlos** — aprendiz, será **líder técnico** del proyecto.
- **Laura y Diego** — aprendices del equipo.

### Acto 1 — Marta arma su ficha

Marta entra (login con 2FA). Crea la **ficha 2826503**, jornada *mañana*, y sube un **Excel con 25 aprendices**. Kanbana muestra un **preview** y avisa: *"3 correos con dominio inválido"* (validó el MX antes de importar). Corrige, confirma, y salen las invitaciones por correo.
→ *Funciones: fichas, importación masiva, validación de correo, SMTP.*

### Acto 2 — Los aprendices entran

Laura crea su cuenta desde el correo. Diego ya se había registrado con **Google** sin ficha, así que va a **"Solicitar vinculación"** (código `2826503` + jornada + documento). Marta **aprueba** la solicitud → Diego recibe confirmación y queda en la ficha.
→ *Funciones: OAuth Google, vinculación de aprendices, aprobación del instructor.*

### Acto 3 — Nace el proyecto

Marta crea el proyecto **"App de Citas Médicas"** y nombra a **Carlos líder técnico** (`es_lider_tecnico`). Carlos le pregunta a **KanbanaAI** qué módulos usar; la IA (Gemini 2.5 Flash) sugiere *Análisis, Diseño, Backend, Frontend, Pruebas* según la plantilla SDLC. Carlos acepta y se crean los **sprints/módulos**.
→ *Funciones: proyectos, sub-rol líder, IA, sugerencias de módulos.*

### Acto 4 — A trabajar (el tablero)

Carlos crea tareas en el **Backlog**: a Laura *"Diseñar login"*, a Diego *"API de citas"*. En el **Tablero**, Laura arrastra su tarjeta `To Do → In Progress`. Diego conecta **GitHub**, vincula el repo y hace `git commit -m "KAN-42 endpoint de crear cita"`. El **webhook** mueve la tarea **#42 sola a *In Progress***; al abrir el PR → *Testing*; con el merge → *Done*.
→ *Funciones: tablero drag & drop, GitHub (OAuth + webhooks), commits que mueven tareas, ciclo de vida del ticket.*

### Acto 5 — Seguimiento y avisos

Laura comenta en la tarea de Diego → él recibe una **notificación en tiempo real** (WebSocket). Marta ve en su **dashboard** el avance, las tareas vencidas (`fecha_limite`/`hora_limite`) y usa la **búsqueda universal** para ubicar la tarea.
→ *Funciones: comentarios, notificaciones, dashboard, búsqueda universal, fechas límite.*

### Frase que resume el propósito

> *"Kanbana traduce el trabajo formativo del aprendiz en un flujo de proyecto profesional: lo que codifican en GitHub se refleja automáticamente en el tablero, y el instructor lo supervisa todo en un solo lugar."*

---

## 16. Preguntas de práctica sobre el caso (defensa)

**P1: ¿Qué pasa EXACTAMENTE cuando Diego hace el commit `KAN-42`?**
R: GitHub envía un evento `push` al endpoint `POST /api/github/webhook`. `github.service.ts` lo recibe, registra el commit y `parseTicketRefs` detecta el patrón `KAN-42` (o `#42`). Encuentra la tarea 42 y la mueve a *In Progress*. El `WebhookEvent` se guarda para idempotencia (no procesar dos veces el mismo evento). Luego, el PR pasa la tarea a *Testing* y el merge a *Done*.

**P2: ¿Por qué Diego tuvo que "solicitar vinculación" y Laura no?**
R: Laura nació desde la invitación de la ficha (ya tenía `fichaId`). Diego se registró por su cuenta con Google sin ficha, entonces su `vinculacion_estado` quedó en `none`. Al pedir unirse pasa a `pendiente`, y solo cuando el instructor aprueba pasa a `aprobado` y se le asigna la ficha. Es un control para que un instructor valide quién entra a su grupo.

**P3: ¿Carlos es un rol distinto en la base de datos?**
R: No. Carlos sigue siendo `rol = 'aprendiz'`; lo que cambia es el campo booleano `es_lider_tecnico = true`. Eso le habilita el dashboard de gestión sin duplicar la lógica de permisos ni crear un rol nuevo.

**P4: Si te pido ver el código que mueve la tarea con el commit, ¿a dónde vas?**
R: A `backend/src/github/github.service.ts` (métodos `processPush` / `processPullRequest`) y al helper de parseo de referencias de ticket (`KAN-` / `#`).
`</content>`
