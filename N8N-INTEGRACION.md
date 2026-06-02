# 🔌 Integración con n8n — Kanbana

Automatización de flujos con **n8n** (open-source, self-hosted). La integración es
**bidireccional**:

- **Kanbana → n8n (saliente):** cada notificación interna se emite como evento a un
  webhook de n8n.
- **n8n → Kanbana (entrante):** n8n llama por cron al endpoint de *resumen diario* y
  envía un correo/mensaje al instructor con sus tareas pendientes y vencidas.

---

## 1. Variables de entorno (backend/.env)

Añade estas dos variables a `backend/.env`:

```env
# URL del webhook de n8n al que Kanbana envía eventos (dirección SALIENTE).
# La obtienes del nodo "Webhook" en n8n (ver paso 4). Si la dejas vacía,
# la salida queda apagada (no rompe nada).
N8N_WEBHOOK_URL=http://n8n:5678/webhook/kanbana-eventos

# API key que n8n debe enviar (cabecera x-n8n-key) para consumir los
# endpoints de Kanbana (dirección ENTRANTE). Invéntala tú.
N8N_API_KEY=una-clave-larga-y-secreta
```

> 💡 Dentro de Docker, los contenedores se ven por su nombre de servicio:
> Kanbana llega a n8n con `http://n8n:5678` y n8n llega al backend con `http://backend:3000`.

Reinicia el backend tras añadirlas:
```bash
docker compose -f docker-compose.dev.yml restart backend
```

---

## 2. Levantar n8n

Ya está añadido a `docker-compose.yml` y `docker-compose.dev.yml`. Solo levanta el stack:

```bash
docker compose -f docker-compose.dev.yml up -d
```

Abre el editor de n8n: **http://localhost:5678**
Usuario: `admin` · Contraseña: `kanbana2026` (definidos en el compose).

---

## 3. Endpoints que expone Kanbana para n8n

Todos bajo el prefijo `/api`, protegidos con la cabecera `x-n8n-key: <N8N_API_KEY>`.

| Método | Ruta | Para qué |
|--------|------|----------|
| GET | `/api/integrations/n8n/resumen-diario` | Tareas pendientes/vencidas agrupadas por instructor |
| GET | `/api/integrations/n8n/status` | Ver si la salida está configurada |
| POST | `/api/integrations/n8n/test` | Disparar un evento de prueba hacia n8n |

**Ejemplo de respuesta de `resumen-diario`:**
```json
{
  "generado_en": "2026-05-31T13:00:00.000Z",
  "total_instructores": 1,
  "resumenes": [
    {
      "instructor": { "id": 4, "nombre": "Marta Ríos", "correo": "marta@sena.edu.co" },
      "ficha": "2826503",
      "total_pendientes": 7,
      "vencidas": [
        { "id": 42, "titulo": "API de citas", "estado": "in_progress",
          "prioridad": "alta", "proyecto": "App de Citas", "asignado_a": "Diego",
          "fecha_limite": "2026-05-28" }
      ],
      "proximas_24h": []
    }
  ]
}
```

**Probar a mano (PowerShell):**
```powershell
curl http://localhost:3000/api/integrations/n8n/resumen-diario -H "x-n8n-key: una-clave-larga-y-secreta"
```

---

## 4. Workflow A — Resumen diario (n8n → Kanbana → correo)

En el editor de n8n crea un workflow con estos 4 nodos:

1. **Schedule Trigger** (cron)
   - Modo: *Every Day*, hora **07:00** (zona `America/Bogota`).

2. **HTTP Request** (consulta a Kanbana)
   - Method: `GET`
   - URL: `http://backend:3000/api/integrations/n8n/resumen-diario`
   - Headers → Add: `x-n8n-key` = `una-clave-larga-y-secreta`

3. **Split Out / Item Lists** (opcional)
   - Campo a separar: `resumenes` → genera un item por instructor.

4. **Send Email** (o **Telegram / Gmail / Slack**)
   - Para: `{{ $json.instructor.correo }}`
   - Asunto: `Resumen Kanbana — {{ $json.total_pendientes }} tareas pendientes`
   - Cuerpo: recorre `vencidas` y `proximas_24h` para listar las tareas.

Activa el workflow (toggle **Active**). Listo: cada mañana el instructor recibe su resumen.

---

## 5. Workflow B — Recibir eventos de Kanbana (Kanbana → n8n)

1. **Webhook** (trigger)
   - Method: `POST`
   - Path: `kanbana-eventos`
   - La URL final será `http://n8n:5678/webhook/kanbana-eventos` → esa es la que pones
     en `N8N_WEBHOOK_URL`.

2. **Switch** (por tipo de evento)
   - Lee `{{ $json.evento }}` (p.ej. `notificacion.creada`).

3. **Telegram / Discord / Slack / Sheets**
   - Envía `{{ $json.datos.titulo }}` y `{{ $json.datos.mensaje }}` al canal que quieras.

**Probar la salida** sin esperar un evento real:
```powershell
curl -X POST http://localhost:3000/api/integrations/n8n/test -H "x-n8n-key: una-clave-larga-y-secreta"
```
Debe llegar a tu webhook un payload:
```json
{ "evento": "test", "datos": { "mensaje": "Hola desde Kanbana 👋" },
  "origen": "kanbana", "emitido_en": "..." }
```

---

## 6. Cómo está implementado (para defender en la exposición)

| Pieza | Archivo |
|-------|---------|
| Servicio de integración (emit + resumen) | `backend/src/integrations/n8n.service.ts` |
| Guard de API key | `backend/src/integrations/n8n-api-key.guard.ts` |
| Endpoints | `backend/src/integrations/integrations.controller.ts` |
| Módulo | `backend/src/integrations/integrations.module.ts` |
| Eventos salientes | `backend/src/notifications/notifications.service.ts` (método `create`) |
| Contenedor n8n | `docker-compose.yml` / `docker-compose.dev.yml` (servicio `n8n`) |

**Diseño clave:** los eventos salientes son *fire-and-forget* — si n8n está caído o no
configurado, Kanbana sigue funcionando igual (nunca lanza error). El endpoint entrante
no usa JWT (n8n no es un usuario) sino una **API key** por cabecera.

---

## 7. Preguntas típicas del jurado

**P: ¿Qué es n8n y por qué lo usas?**
R: Una herramienta de automatización de flujos open-source. Permite conectar Kanbana con
servicios externos (correo, Telegram, Sheets) sin escribir código de integración para
cada uno: lo configuro visualmente en workflows.

**P: ¿Cómo se comunican Kanbana y n8n?**
R: Por HTTP en ambos sentidos. Kanbana hace POST a un webhook de n8n cuando ocurre un
evento; y n8n llama por cron a un endpoint REST de Kanbana (protegido por API key) para
armar el resumen diario.

**P: ¿Qué pasa si n8n se cae?**
R: Nada en Kanbana: los eventos salientes son fire-and-forget con try/catch, y si la
variable `N8N_WEBHOOK_URL` no está, la salida simplemente no se dispara.
