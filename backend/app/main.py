from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
import app.models  # noqa: F401 — registra todos los modelos antes de montar routers
from app.routers import auth, users, employees, payroll, holidays, timesheets, reports, companies, absences, settlements

FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
from app.core.database import run_migrations, create_tables
from app.middleware.security import SecurityHeadersMiddleware

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="PayApp - Nómina Empresarial",
    description="Sistema de nómina para PYMES",
    version="1.0.0",
    docs_url="/api/docs" if settings.DEBUG else None,
    redoc_url="/api/redoc" if settings.DEBUG else None,
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["*"],
)

# Security headers
app.add_middleware(SecurityHeadersMiddleware)

# Trusted hosts (incluir localhost para healthchecks internos)
_allowed_hosts = list(settings.ALLOWED_HOSTS)
for _h in ("localhost", "127.0.0.1"):
    if _h not in _allowed_hosts:
        _allowed_hosts.append(_h)
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=_allowed_hosts,
)

# Routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Autenticación"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Usuarios"])
app.include_router(employees.router, prefix="/api/v1/employees", tags=["Empleados"])
app.include_router(settlements.router, prefix="/api/v1/employees", tags=["Liquidaciones"])
app.include_router(companies.router, prefix="/api/v1/companies", tags=["Empresas"])
app.include_router(absences.router, prefix="/api/v1/absences", tags=["Ausencias"])
app.include_router(payroll.router, prefix="/api/v1/payroll", tags=["Nómina"])
app.include_router(holidays.router, prefix="/api/v1/holidays", tags=["Días feriados"])
app.include_router(timesheets.router, prefix="/api/v1/timesheets", tags=["Marcación"])
app.include_router(reports.router, prefix="/api/v1/reports", tags=["Reportería"])


@app.on_event("startup")
async def apply_migrations():
    """Tablas, migraciones y admin inicial. No tumba el arranque si la DB falla."""
    try:
        await create_tables()
        print("OK tablas verificadas", flush=True)
        await run_migrations()
        print("OK migraciones aplicadas", flush=True)
    except Exception as exc:
        print(f"WARN migraciones al startup: {exc}", flush=True)
        return

    try:
        from sqlalchemy import select
        from app.core.database import AsyncSessionLocal
        from app.core.security import hash_password
        from app.models.user import User, UserRole

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(User).where(User.username == "admin"))
            if result.scalar_one_or_none() is None:
                db.add(User(
                    email="admin@payapp.com",
                    username="admin",
                    full_name="Administrador",
                    role=UserRole.admin,
                    hashed_password=hash_password("Admin123!"),
                    is_active=True,
                ))
                await db.commit()
                print("OK usuario admin creado", flush=True)
            else:
                print("OK usuario admin ya existe", flush=True)
    except Exception as exc:
        print(f"WARN seed admin al startup: {exc}", flush=True)


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "app": "PayApp"}


if FRONTEND_DIST.is_dir():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api"):
            raise HTTPException(status_code=404)
        file_path = FRONTEND_DIST / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        index = FRONTEND_DIST / "index.html"
        if index.is_file():
            return FileResponse(index)
        raise HTTPException(status_code=404)
