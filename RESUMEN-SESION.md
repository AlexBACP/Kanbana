# Resumen de Sesión — Para retomar Kanbana

> **Para el próximo Claude:** lee este archivo PRIMERO al arrancar. Te pone al día sin tener que reconstruir nada.
> **Para Brandon:** este es el archivo que abres con `lee C:/Kanbana/RESUMEN-SESION.md` al inicio de la nueva sesión.

---

## 🎯 Feature en curso (donde paramos)

**Auto-registro de instructores con validación @sena.edu.co**

Problema: hoy solo aprendices se auto-registran; instructores los crea un admin. Brandon quiere que los instructores también se auto-registren, pero verificando que sean realmente del SENA y no aprendices haciéndose pasar.

### Diseño aprobado: 3 capas de seguridad

```
Registro → Capa 1: dominio @sena.edu.co (validado por backend)
        → Capa 2: confirmar correo (cuenta_confirmada=true)
        → Capa 3: coordinador aprueba (aprobacion_coord_estado=aprobado)
        → Login permitido
```

### Decisiones de diseño tomadas

1. **Primer coordinador**: se crea manualmente por script seed (no auto-registro).
2. **Coordinadores adicionales**: los crea otro coordinador desde el panel de usuarios (NO se auto-registran).
3. **Dominios SENA**: configurables vía env `SENA_INSTRUCTOR_DOMAINS` (default `@sena.edu.co`).
4. **Rechazo**: el instructor rechazado puede reintentar tras **24h** de cooldown.

### Estado de las tareas (#35-#43)

| # | Tarea | Estado |
|---|---|---|
| 35 | Backend: campos `aprobacion_coord_*` en User | ✅ |
| 36 | Backend: endpoint `POST /api/auth/register-instructor` | ✅ |
| 37 | Backend: bloquear login si pendiente/rechazado | ✅ |
| **38** | **Backend: endpoints listar/aprobar/rechazar instructores** | **🟡 NO EMPEZADO el código (siguiente paso)** |
| 39 | Backend: notificar a coordinadores al confirmar correo | ⏳ |
| 40 | Backend: script seed primer coordinador | ⏳ |
| 41 | Frontend: toggle Aprendiz/Instructor en LoginAside | ⏳ |
| 42 | Frontend: pantalla "esperando aprobación coordinador" | ⏳ |
| 43 | Frontend: panel del coordinador para aprobar/rechazar | ⏳ |

### Archivos ya modificados en esta feature

- `backend/src/users/entities/user.entity.ts` → enum `AprobacionCoordEstado` + 3 campos
- `backend/src/users/users.service.ts` → método `createSelfRegisteredInstructor`, actualizado `findByEmail` select
- `backend/src/auth/auth.service.ts` → método `registerInstructor` + bloqueo en `validateUser`
- `backend/src/auth/auth.controller.ts` → endpoint `POST /api/auth/register-instructor`

### Próximo paso exacto (al retomar)

Empezar **Tarea 38**:
1. Añadir 3 métodos en `users.service.ts`:
   - `listarInstructoresPendientes()` → solo coordinador, devuelve users con `rol='instructor'` Y `aprobacion_coord_estado='pendiente'` Y `cuenta_confirmada=true`
   - `aprobarInstructor(targetId, actor)` → solo coordinador. Pone estado=aprobado.
   - `rechazarInstructor(targetId, actor, motivo)` → solo coordinador. Guarda motivo + fecha (para cooldown 24h).
2. Añadir 3 endpoints en `users.controller.ts`:
   - `GET /api/users/instructores-pendientes`
   - `PATCH /api/users/:id/aprobar-instructor`
   - `PATCH /api/users/:id/rechazar-instructor` (body: `{ motivo }`)
3. Las notificaciones al instructor (aprobado/rechazado) van DENTRO de estos métodos: `notificationsService.create(...)` con `action_data` para deep-link.

---

## ⏸️ Otras features PAUSADAS en esta sesión

### A) Wizard de trimestres históricos (#32, #33, #34)

> Objetivo: que fichas que ya cursaron trimestres puedan adoptar Kanbana declarando los pasados como "histórico ligero" (solo nombre + fechas + evidencia opcional), sin reconstruir tareas.

**Backend completo** (tareas #29, #30, #31 ya ✅):
- Enum `EstadoTrimestre` (planificado | activo | completado | **historico**)
- Endpoint `POST /api/fichas/:id/declarar-historico` listo
- Endpoint `POST /api/fichas/upload-evidencia` listo
- Bloqueo de crear módulos/tareas en trimestres históricos

**Frontend pendiente** (#32, #33, #34):
- Wizard al crear ficha: paso "¿Esta ficha es nueva o ya está en curso?"
- Botón "Declarar trimestres pasados" en `FichasPanel` (ficha existente)
- Vista de trimestre histórico: panel sin tablero, solo Resumen + visor de evidencia

**Cuando retomar:** decisiones ya tomadas (evidencia opcional con advertencia, coord+instructor pueden usar wizard, sin módulos del histórico, también botón en fichas existentes). Frontend es puro React/TypeScript.

### B) Bugs conocidos sin resolver

1. **Logs de diagnóstico todavía activos** (eran temporales para debug):
   - `backend/src/notifications/kanban.gateway.ts` — `this.logger.log('🔌 Cliente conectado...')` etc.
   - `frontend/src/hooks/useSocket.ts` — `console.log('[socket] ✅ conectado'...)` etc.
   → Limpiar cuando se confirme que el realtime funciona en producción.

2. **Tema claro sigue "muy claro"** — paleta off-white ya aplicada pero Brandon sentía que sigue deslumbrando. Posible afinación pendiente.

3. **Realtime de notificaciones** — el push por socket SÍ está enchufado (`notificationsService.create` llama a `gateway.notifyUser`), pero Brandon reportó que no veía toasts. Quedó pendiente confirmar si era por backend no reiniciado o algo más.

---

## 📦 Estado general de Kanbana (lo que YA está construido)

- **Backend**: NestJS 11, 16 módulos, ~160 endpoints REST, MySQL + TypeORM, Socket.io, integración GitHub/Google OAuth/Gemini IA/n8n/SMTP/IMAP
- **Frontend**: React 18 + TypeScript, 15 páginas, 40+ componentes, Zustand stores, TailwindCSS
- **Infra**: Docker Compose con 5 contenedores (mysql, redis, backend, frontend, n8n)
- **Features clave funcionando**: tablero Kanban con drag&drop, realtime (sockets + presencia), notificaciones, comentarios en vivo, visor de archivos integrado (PDF/imágenes/video), aprobación de módulos por instructor, flujo aprendiz→líder→instructor para tareas, GitHub commits mueven tareas automáticamente, asistente IA KanbanaAI

---

## 📂 Archivos importantes en `documentos/`

- `DOSSIER-EXPOSICION.md` — guía completa para defender el proyecto (jurado, exposición)
- `INFORME-KANBANA-2026.md` — informe técnico actualizado
- `Manual-de-Usuario-Kanbana-DNP.docx` — manual con plantilla DNP
- `N8N-INTEGRACION.md` — guía de la integración con n8n
- `SMOKE-TEST-KANBANA.md` — resultados del smoke test con 4 perfiles
- `CV-Brandon-Palma-v2.docx` — CV reescrito (cabecera, summary, skills agrupados, Kanbana como Career History, Honors & Awards con Mejor Aprendiz SENA, References con Alexander Montealegre Ramírez)

---

## 🚧 Pendientes menores del smoke test

- ❌ Bloquear cambio de contraseña si es **igual** a la actual
- 🟡 Símbolos obligatorios en política de contraseña (`#%@!`)
- 🟡 Aplicar límite real de 2 cambios/día (campos en BD ya existen, falta la lógica)
- 🟡 Mostrar banner/portada en `ProfilePage`

---

## 🛠️ Comandos útiles para retomar

```bash
# Arrancar el stack
cd /c/Kanbana
docker compose -f docker-compose.dev.yml up -d mysql redis backend frontend

# Si cambia código del backend, reiniciar:
docker restart kanbana-backend-1
docker logs kanbana-backend-1 --tail 30

# Type-check (verificar que no hay errores antes de seguir)
cd /c/Kanbana/backend && npx tsc --noEmit
cd /c/Kanbana/frontend && npx tsc -b --noEmit

# Subir cambios a GitHub (al final del día)
cd /c/Kanbana && git add -A && git commit -m "feat: ..."
git push origin main
```

---

## 🔑 Recordatorios críticos para el próximo Claude

1. **Brandon es líder técnico del proyecto Kanbana** (proyecto formativo SENA ADSO en Ibagué). Es el desarrollador principal.
2. **Stack que él conoce**: React 18, TypeScript, NestJS 11, MySQL, TypeORM, Docker, Socket.io.
3. **Su estilo**: prefiere decisiones rápidas, plan corto, código incremental con verificación frecuente. NO le gustan los muros de texto innecesarios.
4. **Verifica TypeScript** tras cambios grandes con `npx tsc --noEmit` (backend) o `npx tsc -b --noEmit` (frontend). Si no quiere esperar, no insistas.
5. **Brandon trabaja en WSL** desde Windows. Docker corre en Docker Desktop. A veces hay glitches con DNS o el daemon.
6. **El repo está en `https://github.com/AlexBACP/Kanbana`** — rama `main` activa.
7. **Si Brandon menciona un archivo o feature que no recuerdas**, primero busca con `grep`/`Glob` antes de preguntar — la mayoría está documentado.

---

**Último mensaje real de la sesión:** Brandon preguntó si la ventana de contexto se reinicia al cambiar de modelo. Le expliqué que no, solo al abrir una nueva conversación. Pidió que generara este resumen para poder cerrar y empezar fresco.

**Próximo paso al retomar:** continuar la **Tarea 38** desde donde se describe arriba.
