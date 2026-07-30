"""
Script para inicializar la base de datos y crear el usuario admin por defecto.
Ejecutar: python seed.py
"""
import asyncio
import sys
import traceback

from app.core.config import settings
from app.core.database import create_tables, run_migrations, AsyncSessionLocal
from app.core.security import hash_password
import app.models  # noqa: F401 — registra todos los modelos (Settlement, Absence, etc.)
from app.models.user import User, UserRole


async def seed():
    print(
        f"Conectando a DB {settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME} "
        f"como {settings.DB_USER}...",
        flush=True,
    )

    print("Creando tablas...", flush=True)
    await create_tables()
    print("OK Tablas creadas", flush=True)

    print("Aplicando migraciones...", flush=True)
    await run_migrations()
    print("OK Migraciones aplicadas", flush=True)

    async with AsyncSessionLocal() as db:
        from sqlalchemy import select
        result = await db.execute(select(User).where(User.username == "admin"))
        existing = result.scalar_one_or_none()

        if not existing:
            admin = User(
                email="admin@payapp.com",
                username="admin",
                full_name="Administrador",
                role=UserRole.admin,
                hashed_password=hash_password("Admin123!"),
                is_active=True,
            )
            db.add(admin)
            await db.commit()
            print("OK Usuario admin creado", flush=True)
            print("   Username: admin", flush=True)
            print("   Password: Admin123!", flush=True)
            print("   CAMBIA LA CONTRASENA EN PRODUCCION", flush=True)
        else:
            print("OK Usuario admin ya existe", flush=True)

    print("\nOK Base de datos inicializada correctamente", flush=True)


if __name__ == "__main__":
    try:
        asyncio.run(seed())
    except Exception as exc:
        print(f"ERROR en seed.py: {exc}", flush=True)
        traceback.print_exc()
        sys.exit(1)
