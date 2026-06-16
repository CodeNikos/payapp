# PayApp — Sistema de Nómina Empresarial para PYMES

Stack: **React + Vite + Material UI** (frontend) · **FastAPI + PostgreSQL** (backend)

---

## Estructura del Proyecto

```
payapp/
├── backend/
│   ├── app/
│   │   ├── core/          # config, database, security (JWT)
│   │   ├── models/        # SQLAlchemy models (User, Employee, Payroll)
│   │   ├── schemas/       # Pydantic schemas
│   │   ├── routers/       # auth, users, employees, payroll
│   │   ├── middleware/    # Security headers
│   │   └── main.py
│   ├── seed.py            # Crea tablas e inserta admin inicial
│   ├── requirements.txt
│   └── .env
└── frontend/
    ├── src/
    │   ├── theme/         # MUI theme (paleta negro + lima)
    │   ├── context/       # Zustand auth store
    │   ├── services/      # Axios con interceptores JWT
    │   ├── components/    # Layout, ProtectedRoute
    │   └── pages/         # Login, Dashboard, Empleados, Nómina, Usuarios
    ├── package.json
    └── vite.config.ts
```

---

## 1. Configurar el Backend

```bash
cd E:\Desarrollo\Planilla\payapp\backend

# Crear entorno virtual
python -m venv venv
venv\Scripts\activate         # Windows
# source venv/bin/activate    # Linux/Mac

# Instalar dependencias
pip install -r requirements.txt

# Verificar .env (ya configurado con tus credenciales)
# Inicializar base de datos y crear admin
python seed.py

# Ejecutar servidor
uvicorn app.main:app --reload --port 8000
```

**Usuario admin inicial:**
- Username: `admin`
- Password: `Admin123!`
- ⚠️ Cambia la contraseña en producción

API Docs disponible en: http://localhost:8000/api/docs

---

## 2. Configurar el Frontend

```bash
cd E:\Desarrollo\Planilla\payapp\frontend

npm install
npm run dev
```

App en: http://localhost:5173

---

## Seguridad implementada

| Capa | Mecanismo |
|------|-----------|
| Autenticación | JWT (access 30min + refresh 7 días) |
| Contraseñas | bcrypt rounds=12 |
| Rate limiting | 60 req/min general · 10 req/min en login |
| Bloqueo de cuenta | 5 intentos fallidos → bloqueo 15 min |
| Headers HTTP | CSP, X-Frame-Options, HSTS, XSS-Protection |
| Roles | `admin` · `operador_nomina` con rutas protegidas |
| CORS | Solo orígenes permitidos en .env |

---

## Variables de entorno (.env)

```env
# IMPORTANTE: Cambiar en producción
JWT_SECRET_KEY=<genera con: python -c "import secrets; print(secrets.token_urlsafe(64))">
SECRET_KEY=<genera uno diferente>
DEBUG=False  # en producción
```

---

## Módulos del sistema

- **Dashboard** — KPIs, gráfico de evolución de nómina
- **Empleados** — CRUD completo, búsqueda, estados
- **Nóminas** — Cálculo automático (SS 9.75%, ISLR, horas extra), aprobación por admin
- **Usuarios** — Gestión de accesos (solo admin)

---

## Cálculo de Nómina (Panamá)

```
Salario Bruto = Salario Base + Horas Extra (1.5x) + Bonificaciones
Seguro Social = Bruto × 9.75%
ISLR          = Bruto × 15% (si Bruto > $800)
Neto          = Bruto - SS - ISLR - Otras Deducciones
```

---

## Despliegue en Seenode (servicio único)

FastAPI sirve la API y el build estático de React desde un solo Web Service.

### GitHub

```powershell
cd E:\Desarrollo\Planilla\payapp
git add .
git status   # confirmar que no aparece backend/.env ni venv/node_modules
git commit -m "Preparar PayApp para despliegue en Seenode"
git remote add origin https://github.com/TU_USUARIO/payapp.git
git push -u origin main
```

### PostgreSQL en Seenode

1. [cloud.seenode.com](https://cloud.seenode.com) → **Databases** → Create → PostgreSQL
2. Misma región que el Web Service
3. Anotar `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`

### Web Service

| Campo | Valor |
|-------|-------|
| Root Directory | `backend` |
| Build Command | `pip install -r requirements.txt && cd ../frontend && npm ci && npm run build` |
| Start Command | `python seed.py && uvicorn app.main:app --host 0.0.0.0 --port 8000` |
| Port | `8000` |

Variables de entorno (ver también [`backend/.env.example`](backend/.env.example)):

```env
DB_HOST=<host Seenode>
DB_PORT=5432
DB_NAME=<nombre>
DB_USER=<usuario>
DB_PASSWORD=<password>
JWT_SECRET_KEY=<secrets.token_urlsafe(64)>
SECRET_KEY=<otro valor distinto>
DEBUG=False
ALLOWED_HOSTS=["tu-servicio.seenode.com"]
ALLOWED_ORIGINS=["https://tu-servicio.seenode.com"]
```

Tras el primer deploy exitoso, simplificar el Start Command a:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Verificación

- `GET /api/health` → `{"status":"ok","app":"PayApp"}`
- Abrir la URL raíz → login
- Login `admin` / `Admin123!` → cambiar contraseña en producción
