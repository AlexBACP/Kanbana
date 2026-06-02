# Guía — Integración GitHub en Kanbana

> Cómo funciona y cómo probarla de punta a punta.

## 🧠 Cómo funciona, en humano

GitHub es donde vive el **código**; Kanbana es donde vive la **organización**. Ahora hablan entre ellos. La conexión tiene 4 piezas:

1. **La llave (OAuth)** 🔑 — Al pulsar *"Conectar GitHub"* le das permiso a Kanbana para actuar con tu identidad de GitHub. La "llave" (token) se guarda **cifrada**. Cada persona conecta la suya.
2. **El emparejamiento (vincular repo ↔ proyecto)** 🔗 — Le dices a Kanbana que un proyecto vive en un repositorio. Al hacerlo, Kanbana instala un **webhook** (un mensajero) en GitHub.
3. **El mensajero (webhook)** 📨 — Cada *push*, *Pull Request* o rama nueva hace que GitHub avise a Kanbana automáticamente. Kanbana verifica la **firma secreta** del aviso antes de procesarlo.
4. **La traducción (la magia)** ✨ — Kanbana busca el "apellido" de la tarea: **`KAN-<número>`**. Si tu tarea es la #123, escribe **`KAN-123`** en la rama, el commit o el título del PR.

### Transiciones automáticas
```
commit "KAN-123 ..."   →  la tarea pasa a  En desarrollo
Pull Request abierto    →  pasa a  Testing
Pull Request mergeado   →  pasa a  Hecho
```

Reglas implementadas: solo avanza **hacia adelante**, respeta el **adjunto obligatorio**, no procesa un aviso dos veces (idempotencia), verifica firma, y **notifica** al responsable.

**Trazabilidad:** Ticket → Commit → PR → Merge. En cada tarea ves sus commits/ramas/PRs; en el proyecto ves métricas (commits por desarrollador, PRs, etc.).

## 🔐 Permisos
| Acción | Quién |
|---|---|
| Conectar/desconectar su cuenta | Todos (cada quien la suya, independiente) |
| Vincular/desvincular repos a un proyecto | Coordinador · Instructor del proyecto · **Líder técnico de ese proyecto** (validado en backend) |
| Ver actividad/métricas | Cualquiera con acceso al proyecto/ticket |

## ⚠️ Requisito para la automatización: ngrok
El webhook no llega a `localhost`. Para que los avisos lleguen necesitas un túnel público:
1. `ngrok http 3000`
2. En `backend/.env`: `GITHUB_WEBHOOK_URL=https://xxxx.ngrok-free.app/api/github/webhook`
3. Reiniciar el backend.

Sin ngrok funciona: conectar cuenta, ver repos, vincular repo. **No** funciona: que las tareas se muevan solas (los avisos no llegan).

## 🧪 Flujo de prueba desde cero
**Fase 0 — Túnel:** `ngrok http 3000` → pon la URL en `GITHUB_WEBHOOK_URL` → reinicia backend.
**Fase 1 — Conectar:** Configuración → Integraciones → "Conectar GitHub" → autorizar → vuelve con `@tu_usuario`.
**Fase 2 — Vincular repo:** Proyecto → panel "Repositorios GitHub" → "Vincular repositorio" → elige uno tuyo (con permiso admin) → debe quedar con **"Webhook ✓"**.
**Fase 3 — Apellido de la tarea:** abre una tarea; la URL `/tickets/123` → referencia **`KAN-123`**.
**Fase 4 — Disparar (en tu repo):**
1. Rama `feature/KAN-123-login` → aparece en la pestaña GitHub de la tarea.
2. Commit `KAN-123 agrega login` + push → tarea pasa a **En desarrollo**.
3. Pull Request con `KAN-123` en el título → tarea pasa a **Testing**.
4. Merge del PR → tarea pasa a **Hecho** (si no le falta adjunto obligatorio).
**Fase 5 — Trazabilidad:** pestaña **GitHub** de la tarea (ramas/commits/PRs) y panel **GitHub** del proyecto (métricas).

## Configuración (.env)
```
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_OAUTH_CALLBACK=http://localhost:3000/api/github/callback
GITHUB_WEBHOOK_URL=https://xxxx.ngrok-free.app/api/github/webhook
GITHUB_TOKEN_ENC_KEY=<clave de cifrado de tokens>
GITHUB_TICKET_PREFIX=KAN
```
