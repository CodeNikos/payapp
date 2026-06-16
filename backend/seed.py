"""
Script para inicializar la base de datos y crear el usuario admin por defecto.
Ejecutar: python seed.py
"""
import asyncio
from app.core.database import create_tables, run_migrations, AsyncSessionLocal
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.employee import Employee  # noqa: F401 — registers table with Base
from app.models.payroll import Payroll    # noqa: F401 — registers table with Base
from app.models.holiday import Holiday    # noqa: F401 — registers table with Base
from app.models.timesheet import TimesheetEntry  # noqa: F401 — registers table with Base


async def seed():
    print("Creando tablas...")
    await create_tables()
    print("OK Tablas creadas")

    print("Aplicando migraciones...")
    await run_migrations()
    print("OK Migraciones aplicadas")

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
            print("OK Usuario admin creado")
            print("   Username: admin")
            print("   Password: Admin123!")
            print("   CAMBIA LA CONTRASENA EN PRODUCCION")
        else:
            print("OK Usuario admin ya existe")

    print("\nOK Base de datos inicializada correctamente")


if __name__ == "__main__":
    asyncio.run(seed())
