# Checklist Seenode — PayApp

Sigue estos pasos en [cloud.seenode.com](https://cloud.seenode.com) después de publicar el repo en GitHub.

## 1. PostgreSQL

- [ ] **Databases** → Create database → PostgreSQL
- [ ] Misma región que el Web Service
- [ ] Anotar: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- [ ] Asignar la BD al proyecto

## 2. Web Service

- [ ] **New** → **Web Service** → conectar repo `payapp`, rama `main`
- [ ] **Runtime: Python 3.12** (no usar 3.14 — `pydantic-core` no compila aún)
- [ ] Root Directory: **vacío** (raíz del repo)
- [ ] **Build Command:**

```bash
bash build.sh
```

- [ ] **Start Command** (primer deploy):

```bash
bash start.sh
```

- [ ] Port: `80`

> Todo el proceso está en [`build.sh`](build.sh) y [`start.sh`](start.sh). Seenode no acepta comandos largos con comillas en el dashboard.

## 3. Variables de entorno

Reemplaza los valores entre `<>`:

```env
DB_HOST=<host>
DB_PORT=5432
DB_NAME=<nombre>
DB_USER=<usuario>
DB_PASSWORD=<password>
JWT_SECRET_KEY=<generar>
SECRET_KEY=<generar>
DEBUG=False
ALLOWED_HOSTS=["payapp.seenode.app"]
ALLOWED_ORIGINS=["https://payapp.seenode.app"]
```

Generar claves:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

## 4. Verificación

- [ ] `https://payapp.seenode.app/api/health` → `{"status":"ok","app":"PayApp"}`
- [ ] URL raíz muestra login
- [ ] Recargar `/login` o `/empleados` sin error 404
- [ ] Login con `admin` / `Admin123!`
- [ ] Cambiar contraseña del admin
- [ ] Simplificar Start Command a: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port 80`

## 5. Errores frecuentes

### Seenode no guarda el build command

Usa solo `bash build.sh` y `bash start.sh` (scripts en la raíz del repo).

### `install_node.sh: No such file or directory`

1. En los logs, revisa `Checking out commit …`. Debe ser **`4bee019` o posterior** (no `23c30b2`).
2. Haz **Redeploy** manual en Seenode para tomar el último `main` de GitHub.
3. O usa la **opción B** del build command (instala Node inline, sin script).

Deja **Root Directory vacío** y usa rutas desde la raíz del repo (`backend/requirements.txt`, `frontend/`).

### `npm: not found` o build falla tras `pip install`

El runtime Python no trae Node.js. Usa el build command con `bash install_node.sh` (ver [`backend/install_node.sh`](backend/install_node.sh)).

### `Failed building wheel for pydantic-core` / Python 3.14

Cambia el runtime a **Python 3.12** en Seenode y redeploya. PyO3 (usado por pydantic) aún no soporta 3.14.
