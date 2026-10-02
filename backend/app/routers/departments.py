from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from typing import List, Optional

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.department import Department
from app.models.employee import Employee
from app.models.user import User
from app.schemas.department import DepartmentCreate, DepartmentUpdate, DepartmentResponse

router = APIRouter()

DEFAULT_DEPARTMENTS = [
    "Administración",
    "Ventas",
    "Operaciones",
    "Tecnología",
    "RRHH",
    "Finanzas",
    "Producción",
]


async def _ensure_unique_name(
    db: AsyncSession,
    name: str,
    exclude_id: Optional[int] = None,
) -> str:
    cleaned = name.strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="El nombre del departamento es obligatorio")
    query = select(Department).where(func.lower(Department.name) == cleaned.lower())
    if exclude_id is not None:
        query = query.where(Department.id != exclude_id)
    result = await db.execute(query)
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ya existe un departamento con ese nombre")
    return cleaned


@router.get("/", response_model=List[DepartmentResponse])
async def list_departments(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    include_inactive: bool = Query(False),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Department)
    if not include_inactive:
        query = query.where(Department.is_active == True)
    if search:
        query = query.where(Department.name.ilike(f"%{search}%"))
    result = await db.execute(
        query.order_by(Department.name.asc()).offset(skip).limit(limit)
    )
    return [DepartmentResponse.model_validate(d) for d in result.scalars().all()]


@router.post("/", response_model=DepartmentResponse, status_code=201)
async def create_department(
    data: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    name = await _ensure_unique_name(db, data.name)
    dept = Department(name=name, is_active=data.is_active)
    db.add(dept)
    await db.commit()
    await db.refresh(dept)
    return DepartmentResponse.model_validate(dept)


@router.patch("/{department_id}", response_model=DepartmentResponse)
async def update_department(
    department_id: int,
    data: DepartmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(Department).where(Department.id == department_id))
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(status_code=404, detail="Departamento no encontrado")

    updates = data.model_dump(exclude_unset=True)
    if "name" in updates and updates["name"] is not None:
        new_name = await _ensure_unique_name(db, updates["name"], exclude_id=department_id)
        old_name = dept.name
        if new_name != old_name:
            # Mantener coherencia en empleados que usan el nombre anterior
            await db.execute(
                update(Employee)
                .where(Employee.department == old_name)
                .values(department=new_name)
            )
            dept.name = new_name
        updates.pop("name", None)

    for field, value in updates.items():
        setattr(dept, field, value)

    await db.commit()
    await db.refresh(dept)
    return DepartmentResponse.model_validate(dept)


@router.delete("/{department_id}", status_code=204)
async def deactivate_department(
    department_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(Department).where(Department.id == department_id))
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(status_code=404, detail="Departamento no encontrado")
    dept.is_active = False
    await db.commit()
