from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.employee import Employee, EmployeeStatus
from app.models.company import Company, CompanyStatus
from app.models.user import User
from app.schemas.employee import (
    EmployeeCreate,
    EmployeeUpdate,
    EmployeeResponse,
    EmployeeImportResult,
)
from app.services.vacation import compute_vacation_balance_cutoff
from app.services.company_scope import apply_employee_company_filter, assert_company_filter_valid
from app.services.employee_import import build_import_template_csv, import_employees_csv

router = APIRouter()


def generate_employee_code(db_count: int) -> str:
    return f"EMP-{str(db_count + 1).zfill(5)}"


async def _validate_company_code(db: AsyncSession, company_code: Optional[str]) -> Optional[str]:
    if not company_code:
        return None
    result = await db.execute(select(Company).where(Company.company_code == company_code))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=400, detail="Empresa no encontrada")
    if company.status == CompanyStatus.cancelado:
        raise HTTPException(status_code=400, detail="No se puede asociar a una empresa cancelada")
    return company.company_code


@router.get("/", response_model=List[EmployeeResponse])
async def list_employees(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = None,
    department: Optional[str] = None,
    include_inactive: bool = Query(False),
    company_code: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await assert_company_filter_valid(db, company_code)
    query = select(Employee)
    if not include_inactive:
        query = query.where(Employee.is_active == True)
    query = apply_employee_company_filter(query, company_code)
    if search:
        query = query.where(
            (Employee.first_name.ilike(f"%{search}%")) |
            (Employee.last_name.ilike(f"%{search}%")) |
            (Employee.document_id.ilike(f"%{search}%")) |
            (Employee.employee_code.ilike(f"%{search}%"))
        )
    if department:
        query = query.where(Employee.department == department)

    result = await db.execute(
        query.order_by(Employee.is_active.desc(), Employee.last_name, Employee.first_name)
        .offset(skip)
        .limit(limit)
    )
    return [EmployeeResponse.model_validate(e) for e in result.scalars().all()]


@router.get("/import-template")
async def download_employee_import_template(
    current_user: User = Depends(get_current_user),
):
    """Plantilla CSV para alta masiva de empleados."""
    content = "\ufeff" + build_import_template_csv()
    return Response(
        content=content.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="empleados_plantilla.csv"',
        },
    )


@router.post("/import-csv", response_model=EmployeeImportResult)
async def import_employees_csv_endpoint(
    file: UploadFile = File(...),
    skip_duplicates: bool = Query(True, description="Omitir documentos/correos ya registrados"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="El archivo debe ser .csv")
    raw_bytes = await file.read()
    return await import_employees_csv(db, raw_bytes, skip_duplicates=skip_duplicates)


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

    payload = data.model_dump()
    payload["company_code"] = await _validate_company_code(db, payload.get("company_code"))

    # Generate code
    count_result = await db.execute(select(func.count(Employee.id)))
    count = count_result.scalar()

    employee = Employee(**payload, employee_code=generate_employee_code(count))
    employee.vacation_opening_balance_date = compute_vacation_balance_cutoff(employee.hire_date)
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

    if "company_code" in updates:
        updates["company_code"] = await _validate_company_code(db, updates["company_code"])

    for field, value in updates.items():
        setattr(employee, field, value)

    # Reactivar / desactivar según estado explícito
    if "status" in updates:
        if employee.status == EmployeeStatus.activo:
            employee.is_active = True
            # Un empleado activo no debe conservar fecha de cese
            employee.termination_date = None
        else:
            employee.is_active = False
    elif employee.termination_date and employee.is_active:
        # Cese sin cambio de estado: marcar inactivo
        employee.is_active = False
        if employee.status == EmployeeStatus.activo:
            employee.status = EmployeeStatus.inactivo

    employee.vacation_opening_balance_date = compute_vacation_balance_cutoff(employee.hire_date)

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
    if employee.status == EmployeeStatus.activo:
        employee.status = EmployeeStatus.inactivo
    await db.commit()
