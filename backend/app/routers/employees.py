from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.employee import Employee
from app.models.user import User
from app.schemas.employee import EmployeeCreate, EmployeeUpdate, EmployeeResponse

router = APIRouter()


def generate_employee_code(db_count: int) -> str:
    return f"EMP-{str(db_count + 1).zfill(5)}"


@router.get("/", response_model=List[EmployeeResponse])
async def list_employees(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = None,
    department: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Employee).where(Employee.is_active == True)
    if search:
        query = query.where(
            (Employee.first_name.ilike(f"%{search}%")) |
            (Employee.last_name.ilike(f"%{search}%")) |
            (Employee.document_id.ilike(f"%{search}%")) |
            (Employee.employee_code.ilike(f"%{search}%"))
        )
    if department:
        query = query.where(Employee.department == department)

    result = await db.execute(query.offset(skip).limit(limit))
    return [EmployeeResponse.model_validate(e) for e in result.scalars().all()]


@router.post("/", response_model=EmployeeResponse, status_code=201)
async def create_employee(
    data: EmployeeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Check duplicate document
    result = await db.execute(select(Employee).where(Employee.document_id == data.document_id))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Documento ya registrado")

    # Generate code
    count_result = await db.execute(select(func.count(Employee.id)))
    count = count_result.scalar()

    employee = Employee(**data.model_dump(), employee_code=generate_employee_code(count))
    db.add(employee)
    await db.commit()
    await db.refresh(employee)
    return EmployeeResponse.model_validate(employee)


@router.get("/{employee_id}", response_model=EmployeeResponse)
async def get_employee(
    employee_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    return EmployeeResponse.model_validate(employee)


@router.patch("/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: int,
    data: EmployeeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    updates = data.model_dump(exclude_unset=True)
    if "document_id" in updates and updates["document_id"] != employee.document_id:
        dup = await db.execute(
            select(Employee).where(Employee.document_id == updates["document_id"], Employee.id != employee_id)
        )
        if dup.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Documento ya registrado")

    for field, value in updates.items():
        setattr(employee, field, value)

    await db.commit()
    await db.refresh(employee)
    return EmployeeResponse.model_validate(employee)


@router.delete("/{employee_id}", status_code=204)
async def deactivate_employee(
    employee_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    employee.is_active = False
    await db.commit()
