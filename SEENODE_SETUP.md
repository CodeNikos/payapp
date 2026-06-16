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
- [ ] **Build Command:** `bash build.sh`
- [ ] **Start Command:** `bash start.sh`
- [ ] Port: `80`

> Todo el proceso está en [`build.sh`](build.sh) y [`start.sh`](start.sh).

### Seenode clona un commit viejo (`23c30b2`)

Si en los logs siempre aparece `Checking out commit 23c30b2…`, Seenode **no está tomando el último `main`**. Solución:

1. **GitHub Actions** (recomendado): configura los secrets y deja que el workflow despliegue el SHA correcto.
2. **O** desconecta y vuelve a conectar el repo en Seenode.
3. **O** crea un **nuevo Web Service** desde cero.

#### Configurar GitHub Actions

En GitHub → repo `payapp` → **Settings** → **Secrets and variables** → **Actions**:

| Secret | Valor |
|--------|-------|
| `SEENODE_API_TOKEN` | Token en [Seenode → User API](https://cloud.seenode.com) |
| `SEENODE_APPLICATION_ID` | ID de la app (en la URL del dashboard o Settings) |

El workflow [`.github/workflows/seenode-deploy.yml`](.github/workflows/seenode-deploy.yml) se ejecuta en cada push a `main`.

**Primer deploy manual** (sin esperar push), en PowerShell:

```powershell
$TOKEN = "tu-api-token"
$APP_ID = "tu-application-id"
$SHA = "5e571162f41cf770858a50a0bbda2677c72a5a64"
curl.exe -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{`"gitCommitSha`": `"$SHA`"}" "https://api.seenode.com/v1/applications/$APP_ID/deployments"
```

En los logs del nuevo deploy debe aparecer `Checking out commit 5e57116…` (o más reciente).

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

Seenode puede usar Python 3.14. El repo fija `pydantic-core>=2.41.5` (wheels cp314). Si falla igual, cambia Runtime a **Python 3.12** en el dashboard.
