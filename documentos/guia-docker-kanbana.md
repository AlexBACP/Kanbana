# Guía — Correr Kanbana en Docker (WSL2, sin Docker Desktop)

## Por qué este camino
Tu PC **sí es apto** (Windows 11 Pro, hipervisor activo, WSL2 instalado). Docker Desktop se queda cargando porque **no había ninguna distro de Linux en WSL**, que es lo que su backend necesita. En vez de pelear con la GUI, instalamos **Docker Engine dentro de WSL2** — más confiable.

## Pasos

### 1. Instalar Ubuntu en WSL (PowerShell como administrador)
```powershell
wsl --install -d Ubuntu
```
Reinicia si lo pide. Al abrir Ubuntu por primera vez, crea tu usuario y contraseña de Linux.

### 2. (Recomendado) Activar systemd para que Docker arranque solo
Dentro de Ubuntu:
```bash
sudo bash -c 'printf "[boot]\nsystemd=true\n" > /etc/wsl.conf'
```
Luego en PowerShell: `wsl --shutdown` y vuelve a abrir Ubuntu.

### 3. Instalar Docker Engine dentro de Ubuntu
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```
Cierra y reabre Ubuntu (o `wsl --shutdown` en PowerShell y reabre) para que el grupo `docker` tome efecto.

### 4. Verificar Docker
```bash
docker run hello-world
```
Si no corre el daemon: `sudo service docker start` (o con systemd: `sudo systemctl enable --now docker`).

### 5. Levantar Kanbana
El proyecto en `C:\Kanbana` se ve desde Ubuntu como `/mnt/c/Kanbana`:
```bash
cd /mnt/c/Kanbana
docker compose up --build
```
La primera vez tarda (descarga MySQL, Redis, Node y compila). Cuando termine:
- **Frontend:** http://localhost:5173
- **Backend / API docs:** http://localhost:3000/api/docs

### 6. Comandos útiles
```bash
docker compose up -d            # segundo plano
docker compose logs -f backend  # ver logs del backend
docker compose down             # detener todo
docker compose down -v          # detener y BORRAR datos (MySQL incluido)
```

## Notas importantes
- **La base de datos del contenedor arranca VACÍA.** Tus datos actuales viven en el MySQL de Windows, no en el contenedor. Al primer arranque, `synchronize:true` crea las tablas; registra un usuario o usa el flujo de la app. (Migrar tus datos reales sería un export/import aparte.)
- **Rendimiento:** correr desde `/mnt/c` funciona pero es algo lento (filesystem de Windows). Para máxima velocidad, clona el repo dentro de WSL (`~/kanbana`).
- **Webhooks de GitHub:** si quieres la automatización de tickets, sigue usando **ngrok** apuntando a `localhost:3000` y pon la URL en `GITHUB_WEBHOOK_URL`.
- **Puerto 3306:** MySQL del contenedor NO se publica (para no chocar con tu MySQL local). Si quieres conectarte desde Windows, descomenta `ports: ["3307:3306"]` en `docker-compose.yml`.
