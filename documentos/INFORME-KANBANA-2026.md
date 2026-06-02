# INFORME TÉCNICO — KANBANA
### Sistema de Gestión de Proyectos Formativos para el SENA
**Versión:** 2.0 · **Fecha:** Junio 2026 · **Estado:** En desarrollo activo

---

## 1. DESCRIPCIÓN GENERAL

**Kanbana** es una aplicación web de gestión de proyectos tipo Kanban desarrollada específicamente para el entorno formativo del **SENA (Servicio Nacional de Aprendizaje)**. Su propósito es digitalizar y estructurar el ciclo de vida del software (SDLC) dentro de las fichas de formación, permitiendo que instructores, coordinadores y aprendices gestionen proyectos de software de forma profesional durante su proceso formativo.

### Problema que resuelve

En el SENA, la gestión de proyectos formativos se realizaba de forma desorganizada: hojas de cálculo, grupos de WhatsApp y documentos dispersos. Kanbana centraliza todo el proceso en una sola herramienta que:

- Organiza el trabajo por **Ficha → Trimestre → Módulo → Tarea**
- Conecta el código real de GitHub con la gestión del proyecto
- Permite al instructor supervisar el avance en tiempo real
- Automatiza notificaciones, recordatorios y reportes

---

## 2. ARQUITECTURA DEL SISTEMA

### 2.1 Diagrama general

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENTE (Navegador)                   │
│   React 18 + TypeScript · Vite · TailwindCSS            │
│   TanStack Query · Zustand · socket.io-client            │
└──────────────────┬──────────────────┬───────────────────┘
                   │ HTTP/REST         │ WebSocket
                   ▼                  ▼
┌─────────────────────────────────────────────────────────┐
│                  BACKEND (NestJS 11)                     │
│   16 módulos · ~160 endpoints REST · KanbanGateway WS   │
│   Puerto 3000 · Prefijo /api                             │
└────┬──────────┬────────────┬─────────────┬──────────────┘
     │          │            │             │
     ▼          ▼            ▼             ▼
  MySQL       Redis      Servicios      n8n
  (datos)   (caché)      externos    (automatiz.)
                       GitHub · Google
                       Gemini · SMTP
                       IMAP
```

### 2.2 Infraestructura Docker

El sistema corre en **5 contenedores Docker** sobre WSL2:

| Contenedor | Imagen | Puerto | Función |
|---|---|---|---|
| `kanbana-mysql-1` | mysql:8.0 | interno | Base de datos principal |
| `kanbana-redis-1` | redis:7-alpine | interno | Caché / sesiones |
| `kanbana-backend-1` | node:20-slim | 3000 | API REST + WebSockets |
| `kanbana-frontend-1` | node:20-alpine | 5173 | Interfaz de usuario |
| `kanbana-n8n-1` | n8nio/n8n | 5678 | Automatización de flujos |

---

## 3. STACK TECNOLÓGICO

### 3.1 Frontend

| Tecnología | Versión | Uso |
|---|---|---|
| React | 18.3.1 | Librería UI principal |
| TypeScript | 5.x | Tipado estático |
| Vite | 8.x | Bundler y dev server (HMR) |
| TailwindCSS | 3.4 | Estilos utility-first |
| TanStack Query | 5.95 | Cache y sincronización con el servidor |
| Zustand | 5.0.12 | Estado global del cliente |
| React Router DOM | 7.13.1 | Enrutamiento SPA |
| React Hook Form | 7.72 | Manejo de formularios |
| @dnd-kit | 6.3.1 | Drag & drop del tablero Kanban |
| socket.io-client | 4.8.3 | WebSockets (tiempo real) |
| Framer Motion | 12.38 | Animaciones |
| lucide-react | 0.577 | Iconos |
| react-big-calendar | 1.19.4 | Vista de calendario |
| xlsx | 0.18.5 | Importación de Excel |
| axios | 1.13.6 | Cliente HTTP con interceptores JWT |

### 3.2 Backend

| Tecnología | Versión | Uso |
|---|---|---|
| NestJS | 11.0.1 | Framework principal (módulos, DI, decoradores) |
| TypeORM | 0.3.28 | ORM para MySQL |
| MySQL 2 | 3.20 | Driver de base de datos |
| Passport + JWT | — | Autenticación (access + refresh tokens) |
| Socket.io | 4.8.3 | WebSockets (tiempo real bidireccional) |
| bcrypt | 6.0 | Hash de contraseñas |
| nodemailer | 8.0.7 | Envío de correos (SMTP) |
| imapflow + mailparser | 1.3.4 | Lectura de rebotes (IMAP) |
| otplib + qrcode | 13.4 | 2FA / TOTP |
| multer | 2.1.1 | Subida de archivos |
| @nestjs/schedule | 6.1.3 | Tareas programadas (cron) |
| ioredis | 5.10.1 | Cliente Redis |
| axios | 1.16.1 | Llamadas a APIs externas |
| xlsx | 0.18.5 | Importación masiva de aprendices |

---

## 4. MÓDULOS DEL BACKEND (16 módulos NestJS)

Cada módulo agrupa: Controller (rutas HTTP), Service (lógica de negocio) y Entities (tablas BD).

| # | Módulo | Responsabilidad | Endpoints |
|---|---|---|---|
| 1 | **auth** | Login, registro, JWT, refresh, 2FA, OAuth Google/GitHub | 16 |
| 2 | **users** | CRUD usuarios, perfiles, avatares, contraseñas, vinculación | 26 |
| 3 | **fichas** | Fichas SENA, trimestres, importación Excel, validación MX | 25 |
| 4 | **projects** | Proyectos, módulos, sugerencias IA, flujo de revisión | 39 |
| 5 | **tickets** | Tareas: CRUD, estados, flujo aprendiz↔líder↔instructor | 17 |
| 6 | **comments** | Comentarios en tareas | 3 |
| 7 | **recursos** | Links de proyecto (GitHub, Drive, Figma…) | 6 |
| 8 | **github** | OAuth, repos, webhooks, commits→tareas, métricas | 11 |
| 9 | **notifications** | Notificaciones in-app + WebSocket | 4 |
| 10 | **email** | Correos SMTP + crons + rebotes IMAP | 1 |
| 11 | **dashboard** | Estadísticas por rol | 1 |
| 12 | **permisos** | Permisos temporales del líder | 5 |
| 13 | **chat** | Asistente KanbanaAI (Gemini 2.5 Flash / Ollama) | 1 |
| 14 | **search** | Búsqueda universal | 1 |
| 15 | **integrations** | n8n: resumen diario + eventos salientes | 3 |
| 16 | **app** | Módulo raíz + health check | 1 |
| | **TOTAL** | | **~160 endpoints** |

---

## 5. MODELO DE DATOS (17 entidades / tablas)

### 5.1 Jerarquía principal

```
Ficha (fichas)
 ├── codigo, programa, tipo_formacion, jornada
 ├──◄ Trimestre (trimestres)
 │    └── numero, tipo [documental|desarrollo], fechas, esta_finalizado
 └──◄ User (usuarios) — aprendices de la ficha

Project (proyectos)
 ├── nombre, estado, instructorId, liderId, fichaId
 ├──◄ Sprint (sprints) — módulos del proyecto
 │    ├── nombre, esta_activo, esta_finalizado, trimestre_id
 │    └──◄ Ticket (tickets) — tareas
 │         ├── titulo, estado, prioridad, asignado_a_id
 │         ├── trimestre_id, fecha_limite, hora_limite
 │         ├── completado_por_aprendiz, requiere_adjunto
 │         ├──◄ Comment (comentarios)
 │         └──◄ TicketAttachment (adjuntos)
 ├──◄ ProyectoRecurso (recursos del proyecto)
 └──◄ SugerenciaModulo (propuestas de IA)

User (usuarios)
 ├── nombre, correo, rol [coordinador|instructor|aprendiz]
 ├── es_lider_tecnico (boolean — sub-rol del aprendiz)
 ├── google_id, github_login_id, password_set
 ├── totp_secret, totp_enabled (2FA)
 ├── vinculacion_estado, ficha_solicitada_id
 └── avatar_url, banner_url, jornada

GitHub
 ├── GithubAccount (cuenta vinculada)
 ├── Repository (repos del proyecto)
 ├── GitBranch, GitCommit, GitPullRequest
 └── WebhookEvent (idempotencia)

Otras: Notification, PermisoTemporal
```

### 5.2 Estados de una tarea (ticket)

```
to_do ──► in_progress ──► testing ──► done
  │                          ▲           │
  │      (aprendiz finaliza) │           │ (líder aprueba)
  └──────────────────────────┘           │
                                         │ (líder rechaza)
                              in_progress ◄─────────────────┘
                              + bloqueado (rojo)
```

**Reglas por rol:**
- **Aprendiz:** puede mover `to_do → in_progress` y finalizar (→ `testing`)
- **Líder técnico:** puede mover hasta `testing` + aprobar/rechazar
- **Instructor/Coordinador:** puede mover a cualquier estado

**Condición especial:** si una tarea tiene subtareas sin completar, el aprendiz NO puede finalizarla.

---

## 6. SISTEMA DE ROLES Y PERMISOS

### 6.1 Roles del sistema

| Rol | Base de datos | Qué puede hacer |
|---|---|---|
| **Coordinador** | `rol = 'coordinador'` | Acceso total: fichas, proyectos, usuarios, líderes |
| **Instructor** | `rol = 'instructor'` | Sus fichas y proyectos, aprueba aprendices |
| **Aprendiz** | `rol = 'aprendiz'` | Trabaja en su proyecto (tareas) |
| **Líder técnico** | `rol = 'aprendiz'` + `es_lider_tecnico = true` | Gestiona tablero, equipo y módulos de su proyecto |

> ⚠️ **El líder técnico NO es un rol separado en la BD.** Es un aprendiz con `es_lider_tecnico = true`. Esto evita duplicar lógica de permisos.

### 6.2 Capas de protección

```
[1] ProtectedRoute (React)     → ¿logueado? ¿rol correcto? ¿ficha asignada?
[2] AuthGuard('jwt') / N8nApiKeyGuard → ¿JWT válido?
[3] JwtStrategy.validate()     → ¿usuario existe y está activo en BD?
[4] Lógica del servicio        → ¿permiso sobre ESTE recurso específico?
[5] Interceptor axios          → auto-refresh del token al detectar 401
```

---

## 7. FUNCIONALIDADES IMPLEMENTADAS

### 7.1 Autenticación y seguridad
- ✅ Login con usuario/contraseña (bcrypt)
- ✅ JWT access token (15 min) + refresh token
- ✅ Auto-refresh transparente (interceptor axios)
- ✅ Login con Google OAuth
- ✅ Login con GitHub OAuth
- ✅ 2FA / TOTP (autenticador como Google Authenticator)
- ✅ Recuperación de contraseña por correo
- ✅ Creación de contraseña para usuarios OAuth
- ✅ Confirmación de cuenta por correo

### 7.2 Gestión de fichas y usuarios
- ✅ CRUD de fichas SENA
- ✅ Invitación individual de aprendices (correo)
- ✅ Importación masiva desde Excel con validación MX y preview
- ✅ Captura de rebotes de correo (IMAP) con badge visual
- ✅ Vinculación de aprendices auto-registrados (flujo de solicitud/aprobación)
- ✅ Activación de líder técnico
- ✅ Jornadas (mañana, tarde, noche)
- ✅ Avatares y banners de perfil

### 7.3 Proyectos y módulos
- ✅ CRUD de proyectos vinculados a fichas
- ✅ Trimestres (documental / desarrollo) con fechas
- ✅ Módulos (sprints) por trimestre con estados (planificado/activo/finalizado)
- ✅ Sugerencias de módulos con IA (Gemini 2.5 Flash) según plantilla SDLC
- ✅ Flujo de revisión de módulos (líder envía → instructor aprueba)
- ✅ Cola de trabajo por trimestre (tareas sin módulo, filtradas por trimestre activo)
- ✅ Recursos del proyecto (GitHub, Drive, Figma, Notion…)

### 7.4 Tablero Kanban
- ✅ Drag & drop con @dnd-kit
- ✅ 4 columnas para líder/instructor: Por hacer · En desarrollo · En revisión · Finalizado
- ✅ 3 columnas para aprendiz: Por hacer · En desarrollo · Finalizado
- ✅ Aprendiz puede arrastrar a "Finalizado" → backend convierte a `testing`
- ✅ Líder aprueba/rechaza desde el tablero
- ✅ Miniaturas de adjuntos en las tarjetas (clic → visor)
- ✅ **Tiempo real:** movimientos visibles instantáneamente para todos los usuarios del tablero

### 7.5 Tareas (tickets)
- ✅ CRUD completo (título, descripción, prioridad, fechas, módulo)
- ✅ Asignación a aprendices
- ✅ Subtareas con barra de progreso
- ✅ Adjuntos (subida, descarga, eliminación)
- ✅ Visor de archivos integrado (PDF, imágenes, video, audio, texto)
- ✅ Adjunto obligatorio para trimestres documentales
- ✅ Comentarios con retroalimentación oficial
- ✅ **Comentarios en tiempo real** (aparecen sin recargar)
- ✅ Bloqueo/desbloqueo de tareas con motivo
- ✅ Fecha límite + hora límite

### 7.6 Integración GitHub
- ✅ OAuth para vincular cuenta GitHub
- ✅ Vincular repositorios a proyectos
- ✅ Webhooks: commits con `KAN-XX` → mueven tarea a `in_progress`
- ✅ PR abierto → tarea a `testing`
- ✅ PR mergeado → tarea a `done`
- ✅ Métricas DevOps (commits, PRs, ramas)
- ✅ Vista de actividad GitHub por tarea

### 7.7 Comunicación
- ✅ Notificaciones in-app (WebSocket, tiempo real)
- ✅ Notificaciones del navegador (Web Notifications API)
- ✅ Correos transaccionales: asignación, aprobación, recordatorios, rebotes
- ✅ Crons diarios: recordatorios de plazo (8 AM Colombia), módulos vencidos
- ✅ Búsqueda universal por rol

### 7.8 IA — KanbanaAI
- ✅ Asistente de chat con contexto del proyecto (Gemini 2.5 Flash)
- ✅ Fallback a Ollama (IA local) si no hay GEMINI_API_KEY
- ✅ Sugerencias de módulos SDLC por trimestre
- ✅ Contexto enriquecido: proyecto, módulo activo, equipo, tareas

### 7.9 Automatización con n8n
- ✅ Contenedor n8n integrado (puerto 5678)
- ✅ Resumen diario por cron → instructor recibe listado de tareas vencidas/pendientes
- ✅ Eventos salientes: cada notificación se emite al webhook de n8n
- ✅ Guard por API key para endpoints de n8n
- ✅ Endpoint `/resumen-diario` con datos agrupados por instructor

### 7.10 Tiempo real (WebSockets)
- ✅ KanbanGateway central con rooms por proyecto y por tarea
- ✅ Tablero en vivo: movimientos de tarjetas visibles para todos
- ✅ Comentarios en vivo: aparecen instantáneamente
- ✅ Presencia: avatares de quién está conectado en el tablero
- ✅ Notificaciones push sin recargar la página

---

## 8. SERVICIOS EXTERNOS CONSUMIDOS (8)

| Servicio | Para qué | Implementación |
|---|---|---|
| **GitHub API + OAuth** | Login, repos, webhooks, commits | `github/` módulo |
| **Google OAuth** | Login con Google | `auth/auth.service.ts` |
| **Gemini 2.5 Flash** | IA chat + sugerencias módulos | `chat/chat.service.ts` |
| **Ollama** (local, opcional) | IA alternativa sin internet | `chat/chat.service.ts` |
| **SMTP (Gmail)** | Correos transaccionales | `email/email.service.ts` |
| **IMAP (Gmail)** | Lectura de rebotes | `email/bounce-checker.service.ts` |
| **Socket.io** | WebSockets tiempo real | `notifications/kanban.gateway.ts` |
| **n8n** | Automatización de flujos | `integrations/n8n.service.ts` |

---

## 9. CATÁLOGO DEL FRONTEND

### Páginas (15)
`LandingPage` · `AuthCallbackPage` · `ForgotPasswordPage` · `ResetPasswordPage` · `ConfirmarCuentaPage` · `SolicitarVinculacionPage` · `ProjectPage` · `TrimestreDetailPage` · `TrimestreKanbanPage` · `KanbanPage` · `BacklogPage` · `TicketDetailPage` · `ProfilePage` · `CalendarPage` · `NotFoundPage`

### Componentes principales (40+)
`KanbanBoard` · `KanbanColumn` · `TicketCard` · `FileViewerModal` · `ProjectResourcesCard` · `PresenceAvatars` · `AttachmentGallery` · `AttachmentUploader` · `ChatBubble` · `GithubRepoPanel` · `GitHubWidget` · `Sidebar` · `TopBar` · `SearchModal` · `NotificationBell` · `Avatar` · `LoginAside` · `DateTimeInput` · `Modal` · `SugerenciasCompactas` · `ExcelAprendicesPreview` · `SolicitudesPendientesPanel` · `MiContextoCard` · `TwoFactorModal` · y más.

### Stores Zustand (3)
`auth.store` (sesión + settings + tema) · `notification.store` · `chat.store`

### Services frontend (14)
`api` (axios base + JWT auto-refresh) · `auth` · `user` · `ficha` · `project` · `ticket` · `github` · `notification` · `comment` · `recurso` · `permisos` · `dashboard` · `chat` · `search`

### Hooks personalizados
`useSocket` (notificaciones personales) · `useBoardSocket` (tablero en vivo + presencia) · `useTicketSocket` (comentarios en vivo)

---

## 10. TIEMPO REAL — ARQUITECTURA WEBSOCKET

### Rooms del KanbanGateway

| Room | Participantes | Eventos |
|---|---|---|
| `user:{id}` | Solo ese usuario | `notification` |
| `board:{proyectoId}` | Todos en ese tablero | `ticket:updated`, `presence:update` |
| `ticket:{ticketId}` | Todos viendo esa tarea | `comment:new` |

### Flujo de actualización del tablero

```
Usuario A mueve una tarjeta
        │
        ▼ PATCH /api/tickets/:id/status
        │
        ▼ TicketsService.updateStatus()
        │
        ├─ Guarda en MySQL
        └─ gateway.broadcastTicketUpdated(proyectoId, ticket)
                │
                ▼ socket.io → room board:{proyectoId}
                │
        Usuario B (mismo tablero)
        → ticket:updated → React Query invalida
        → re-fetch → tarjeta se mueve sola ✅
```

---

## 11. FLUJOS CLAVE

### Flujo de vinculación de aprendices
```
Aprendiz se registra (Google/manual)
        │ (sin fichaId)
        ▼
SolicitarVinculacionPage → código + jornada + documento
        │
        ▼ POST /api/users/me/solicitar-vinculacion
        │
        ▼ vinculacion_estado = 'pendiente'
        │ Notificación al instructor
        │
        ▼ Instructor: SolicitudesPendientesPanel
        │ Aprueba / Rechaza
        │
        ▼ vinculacion_estado = 'aprobado'
        │ Correo de confirmación al aprendiz
        ▼
Aprendiz entra al dashboard con su ficha
```

### Flujo de commit → tarea automática
```
git commit -m "KAN-42 endpoint de citas"
git push origin feature/KAN-42
        │
        ▼ GitHub → POST /api/github/webhook
        │
        ▼ github.service.ts → parseTicketRefs()
        │ Detecta "KAN-42" o "#42"
        │
        ▼ Ticket #42 → estado: in_progress
        │ WebhookEvent guardado (idempotencia)
        │
PR abierto → testing · PR mergeado → done
```

### Flujo completo de una tarea
```
Líder crea tarea (to_do)
        ▼
Aprendiz toma (in_progress) — claim
        ▼
Aprendiz trabaja...
        ▼
Aprendiz arrastra a "Finalizado" (testing + completado_por_aprendiz=true)
        ← Validación: ¿subtareas sin completar? → error
        ▼
Líder ve en "En revisión" → Aprueba o Rechaza
        ▼ Aprueba              ▼ Rechaza
      done               in_progress + bloqueado (rojo)
                                ▼
                        Aprendiz corrige y reenvía
```

---

## 12. NÚMEROS CLAVE

| Métrica | Valor |
|---|---|
| Módulos backend (NestJS) | 16 |
| Endpoints REST propios | ~160 |
| Entidades / tablas MySQL | 17 |
| Servicios externos consumidos | 8 |
| Páginas frontend | 15 |
| Componentes React | 40+ |
| Services frontend | 14 |
| Stores Zustand | 3 |
| Hooks personalizados | 3 |
| Roles del sistema | 3 + 1 sub-rol |
| Contenedores Docker | 5 |
| Archivos TypeScript (backend) | 81 |
| Archivos TS/TSX (frontend) | 121 |
| Bloques try/catch | ~96 |

---

## 13. VARIABLES DE ENTORNO REQUERIDAS

### Backend (`backend/.env`)
```env
# Base de datos
DB_HOST=localhost
DB_PORT=3306
DB_USER=kanbana_user
DB_PASSWORD=kanbana2026
DB_NAME=kanbana_db

# JWT
JWT_SECRET=secreto_muy_largo

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

# GitHub OAuth
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_CALLBACK_URL=http://localhost:3000/api/auth/github/callback

# Correo
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=tu@gmail.com
MAIL_PASS=app_password_gmail

# IA
GEMINI_API_KEY=...

# n8n
N8N_WEBHOOK_URL=http://n8n:5678/webhook/kanbana-eventos
N8N_API_KEY=clave_secreta_n8n

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

---

## 14. COMANDOS DE OPERACIÓN

```bash
# Levantar todo
docker compose -f docker-compose.dev.yml up -d

# Ver estado
docker ps --format "table {{.Names}}\t{{.Status}}"

# Ver logs del backend
docker logs kanbana-backend-1 -f --tail=50

# Reiniciar solo el backend
docker restart kanbana-backend-1

# Backup de la base de datos
docker exec kanbana-mysql-1 mysqldump -u kanbana_user -pkanbana2026 kanbana_db > backup_$(date +%Y%m%d).sql

# Restaurar backup
docker exec -i kanbana-mysql-1 mysql -u kanbana_user -pkanbana2026 kanbana_db < backup.sql

# Entrar a MySQL
docker exec -it kanbana-mysql-1 mysql -u kanbana_user -pkanbana2026 kanbana_db
```

---

## 15. ACCESOS EN DESARROLLO

| Servicio | URL |
|---|---|
| Aplicación frontend | http://localhost:5173 |
| API backend | http://localhost:3000/api |
| Documentación Swagger | http://localhost:3000/api/docs |
| n8n (automatización) | http://localhost:5678 |
| n8n credenciales | admin / kanbana2026 |

---

*Informe generado a partir del código fuente real de Kanbana · Junio 2026*
