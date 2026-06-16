from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.routers import auth, users, employees, payroll, holidays, timesheets
from app.core.config import settings

FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
from app.core.database import run_migrations
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

# Trusted hosts
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.ALLOWED_HOSTS,
)

# Routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Autenticación"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Usuarios"])
app.include_router(employees.router, prefix="/api/v1/employees", tags=["Empleados"])
app.include_router(payroll.router, prefix="/api/v1/payroll", tags=["Nómina"])
app.include_router(holidays.router, prefix="/api/v1/holidays", tags=["Días feriados"])
app.include_router(timesheets.router, prefix="/api/v1/timesheets", tags=["Marcación"])


@app.on_event("startup")
async def apply_migrations():
    await run_migrations()


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
