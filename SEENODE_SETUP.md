# Checklist Seenode — PayApp

Sigue estos pasos en [cloud.seenode.com](https://cloud.seenode.com) después de publicar el repo en GitHub.

## 1. PostgreSQL

- [ ] **Databases** → Create database → PostgreSQL
- [ ] Misma región que el Web Service
- [ ] Anotar: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- [ ] Asignar la BD al proyecto

## 2. Web Service

- [ ] **New** → **Web Service** → conectar repo `payapp`, rama `main`
- [ ] Root Directory: `backend`
- [ ] Build Command:

```bash
pip install -r requirements.txt && cd ../frontend && npm ci && npm run build
```

- [ ] Start Command (primer deploy):

```bash
python seed.py && uvicorn app.main:app --host 0.0.0.0 --port 8000
```

- [ ] Port: `8000`

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
ALLOWED_HOSTS=["<tu-servicio.seenode.com>"]
ALLOWED_ORIGINS=["https://<tu-servicio.seenode.com>"]
```

Generar claves:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

## 4. Verificación

- [ ] `https://<tu-servicio.seenode.com>/api/health` → `{"status":"ok","app":"PayApp"}`
- [ ] URL raíz muestra login
- [ ] Recargar `/login` o `/empleados` sin error 404
- [ ] Login con `admin` / `Admin123!`
- [ ] Cambiar contraseña del admin
- [ ] Simplificar Start Command a: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
