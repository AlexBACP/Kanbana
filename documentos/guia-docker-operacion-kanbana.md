# Guía de operación — Kanbana en Docker (WSL2)

> El proyecto corre 100% en Docker (sin Docker Desktop), dentro de WSL2 (Ubuntu).
> **Todo se gestiona desde Ubuntu**, en la carpeta del proyecto.

## 📏 Reglas de oro
1. **Siempre entra a Ubuntu primero.** En PowerShell escribe `wsl`. El prompt cambia a `brandon@...:$`.
2. **Siempre ubícate en el proyecto** antes de cualquier comando de Docker:
   ```bash
   cd /mnt/c/Kanbana
   ```
   Si no, verás el error `no configuration file provided: not found`.
3. **Comandos `docker ...` → dentro de Ubuntu.** Comandos `wsl ...` → en PowerShell.
4. **Si cambias código, hay que reconstruir** (`--build`). Sin eso, el contenedor sigue con el código viejo.

---

## 1. Arrancar el proyecto
```bash
cd /mnt/c/Kanbana
docker compose up -d
```
- `up` levanta los 4 servicios (mysql, redis, backend, frontend).
- `-d` (detached) los deja en segundo plano y te libera la terminal.
- Accesos: **Frontend** http://localhost:5173 · **API** http://localhost:3000/api/docs

## 2. Detener el proyecto
```bash
docker compose stop      # pausa los contenedores (conserva todo)
# o
docker compose down      # los apaga y elimina (los DATOS del volumen se conservan)
```
- `stop` = pausa. `down` = quita los contenedores pero **NO borra los datos** (viven en el volumen `mysql_data`).

## 3. Aplicar cambios de código (¡importante!)
Cada vez que modifiques el código del backend o frontend:
```bash
cd /mnt/c/Kanbana
docker compose up --build -d
```
- `--build` reconstruye las imágenes con el código nuevo.
- Los datos de la BD **se conservan** (el volumen no se toca).
- Reconstruir solo un servicio: `docker compose build backend && docker compose up -d backend`

## 4. Ver el estado de los contenedores
```bash
docker compose ps
```
- Deben aparecer `mysql` (healthy), `redis`, `backend`, `frontend` como **running/Up**.

## 5. Ver logs (depurar)
```bash
docker compose logs -f backend     # logs del backend en vivo (Ctrl+C para salir)
docker compose logs -f             # logs de todos
docker compose logs --tail=50 backend   # últimas 50 líneas
```
- Útil cuando algo "no responde": aquí ves el error real.

## 6. Base de datos (consultas y gestión)
Entrar al MySQL del contenedor:
```bash
docker compose exec mysql mysql -ukanbana_user -pkanbana2026 kanbana_db
```
(escribe `exit` para salir). O ejecutar una consulta directa con `-e`:
```bash
# Ver usuarios
docker compose exec mysql mysql -ukanbana_user -pkanbana2026 kanbana_db \
  -e "SELECT id, nombre, correo, rol FROM usuarios;"
```
> El aviso `Using a password on the command line ... insecure` es **normal**, no es error.

## 7. Gestión de usuarios
- **Registrarse:** http://localhost:5173 → **Crear cuenta** (crea un aprendiz, listo para usar).
- **Volver coordinador** a una cuenta:
  ```bash
  docker compose exec mysql mysql -ukanbana_user -pkanbana2026 kanbana_db \
    -e "UPDATE usuarios SET rol='coordinador' WHERE correo='TU_CORREO';"
  ```
- **Importante:** el rol viaja en el token → tras cambiarlo, **cierra sesión y vuelve a entrar**.

## 8. (Opcional) Webhooks de GitHub con ngrok
Para que los commits/PR muevan tickets solos, GitHub necesita alcanzar tu backend:
```bash
# en Windows o WSL, con ngrok instalado:
ngrok http 3000
```
Copia la URL pública (`https://xxxx.ngrok-free.app`), ponla en `backend/.env`:
```
GITHUB_WEBHOOK_URL=https://xxxx.ngrok-free.app/api/github/webhook
```
y reconstruye: `docker compose up --build -d backend`.

---

# 🛠️ Solución de problemas (imprevistos)

### A. `no configuration file provided: not found`
Estás en la carpeta equivocada. → `cd /mnt/c/Kanbana` y reintenta.

### B. `sudo está deshabilitado en este equipo`
Ejecutaste un comando de Linux en **PowerShell**. → entra a Ubuntu con `wsl` y reintenta ahí.

### C. El backend muestra `ECONNREFUSED ... Retrying (1)(2)(3)` al arrancar
**Normal en el primer arranque**: MySQL tarda en inicializar. El backend reintenta y conecta solo. Solo preocúpate si nunca llega a `Nest application successfully started`.

### D. `Cannot start service ... port is already allocated` (puerto ocupado)
Algo en Windows usa el 3000 o el 5173 (p. ej. un `npm run dev` abierto). Ciérralo, o desde **PowerShell**:
```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object OwningProcess
Stop-Process -Id <PID> -Force
```

### E. `Cannot connect to the Docker daemon`
El motor de Docker no está corriendo en WSL.
```bash
sudo service docker start
# o, si activaste systemd:
sudo systemctl status docker
```
Si reiniciaste el PC y no abre: con systemd activo (paso ya hecho) arranca solo; si no, usa `sudo service docker start`.

### F. Hice cambios pero la app sigue igual
Faltó reconstruir. → `docker compose up --build -d` (no solo `up`). Si aún así no cambia, fuerza sin caché:
```bash
docker compose build --no-cache backend frontend
docker compose up -d
```

### G. El build del frontend falla por errores de tipo (`tsc`)
La imagen empaqueta con `vite build` (sin type-check) a propósito. Si lo cambiaste a `npm run build`, vuelve a `RUN npx vite build` en `frontend/Dockerfile`.

### H. Olvidé la contraseña / no tengo ningún coordinador
Crea/recupera acceso por SQL (ver paso 7) o registra una cuenta nueva y promuévela.

### I. Quiero empezar de cero (BORRAR todos los datos)
```bash
docker compose down -v      # -v elimina los volúmenes (¡borra la BD!)
docker compose up --build -d
```
⚠️ `-v` es destructivo: borra todos los datos de MySQL.

### J. Se llenó el disco / imágenes viejas acumuladas
```bash
docker system df            # cuánto ocupa Docker
docker system prune -a      # borra imágenes/contenedores no usados (libera espacio)
```

### K. Cambié el `.env` y no se aplicó
El `.env` se lee al **arrancar** el contenedor. → `docker compose up -d --force-recreate backend`.

### L. Ver qué IP/red usan los contenedores (debug avanzado)
```bash
docker compose exec backend sh   # entrar a la shell del backend
# dentro: env | grep DB_   (ver variables), ping mysql, etc.
```

---

## Resumen rápido (chuleta)
| Quiero… | Comando (en `/mnt/c/Kanbana`) |
|---|---|
| Arrancar | `docker compose up -d` |
| Detener | `docker compose down` |
| Aplicar cambios de código | `docker compose up --build -d` |
| Ver estado | `docker compose ps` |
| Ver logs backend | `docker compose logs -f backend` |
| Entrar a la BD | `docker compose exec mysql mysql -ukanbana_user -pkanbana2026 kanbana_db` |
| Reset total (borra datos) | `docker compose down -v` |
