from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.user import User
from app.models.employee import Employee
from app.models.recurring_deduction import EmployeeRecurringDeduction, DeductionFrequency
from app.schemas.recurring_deduction import (
    RecurringDeductionCreate,
    RecurringDeductionUpdate,
    RecurringDeductionResponse,
    RecurringDeductionListResponse,
)

router = APIRouter()


def _to_response(row: EmployeeRecurringDeduction) -> RecurringDeductionResponse:
    emp = row.employee
    return RecurringDeductionResponse(
        id=row.id,
        employee_id=row.employee_id,
        employee_name=emp.full_name if emp else None,
        document_id=emp.document_id if emp else None,
        concept=row.concept,
        amount=row.amount,
        frequency=row.frequency,
        monthly_quincena=row.monthly_quincena,
        start_date=row.start_date,
        end_date=row.end_date,
        is_active=row.is_active,
        created_at=row.created_at,
    )


@router.get("/", response_model=RecurringDeductionListResponse)
async def list_recurring_deductions(
    employee_id: Optional[int] = None,
    active_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = (
        select(EmployeeRecurringDeduction)
        .options(selectinload(EmployeeRecurringDeduction.employee))
        .order_by(EmployeeRecurringDeduction.id.desc())
    )
    if employee_id is not None:
        q = q.where(EmployeeRecurringDeduction.employee_id == employee_id)
    if active_only:
        q = q.where(EmployeeRecurringDeduction.is_active.is_(True))
    rows = (await db.execute(q)).scalars().all()
    return RecurringDeductionListResponse(items=[_to_response(r) for r in rows])


@router.post("/", response_model=RecurringDeductionResponse, status_code=201)
async def create_recurring_deduction(
    data: RecurringDeductionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    emp = (
        await db.execute(select(Employee).where(Employee.id == data.employee_id))
    ).scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    row = EmployeeRecurringDeduction(**data.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    result = await db.execute(
        select(EmployeeRecurringDeduction)
        .options(selectinload(EmployeeRecurringDeduction.employee))
        .where(EmployeeRecurringDeduction.id == row.id)
    )
    return _to_response(result.scalar_one())


@router.patch("/{deduction_id}", response_model=RecurringDeductionResponse)
async def update_recurring_deduction(
    deduction_id: int,
    data: RecurringDeductionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(
        select(EmployeeRecurringDeduction)
        .options(selectinload(EmployeeRecurringDeduction.employee))
        .where(EmployeeRecurringDeduction.id == deduction_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Descuento no encontrado")

    updates = data.model_dump(exclude_unset=True)
    frequency = updates.get("frequency", row.frequency)
    monthly_quincena = updates.get("monthly_quincena", row.monthly_quincena)

    if frequency == DeductionFrequency.mensual or (
        "frequency" not in updates and row.frequency == DeductionFrequency.mensual
    ):
        freq = updates.get("frequency", row.frequency)
        if freq == DeductionFrequency.mensual:
            mq = updates.get("monthly_quincena", row.monthly_quincena)
            if mq is None:
                raise HTTPException(
                    status_code=400,
                    detail="monthly_quincena es requerido cuando la frecuencia es mensual",
                )
    if updates.get("frequency") == DeductionFrequency.quincenal:
        updates["monthly_quincena"] = None

    start = updates.get("start_date", row.start_date)
    end = updates.get("end_date", row.end_date)
    if end is not None and start is not None and end < start:
        raise HTTPException(status_code=400, detail="end_date debe ser >= start_date")

    for key, value in updates.items():
        setattr(row, key, value)

    await db.commit()
    await db.refresh(row)
    result = await db.execute(
        select(EmployeeRecurringDeduction)
        .options(selectinload(EmployeeRecurringDeduction.employee))
        .where(EmployeeRecurringDeduction.id == row.id)
    )
    return _to_response(result.scalar_one())


@router.delete("/{deduction_id}", status_code=204)
async def delete_recurring_deduction(
    deduction_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(
        select(EmployeeRecurringDeduction).where(EmployeeRecurringDeduction.id == deduction_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Descuento no encontrado")
    await db.delete(row)
    await db.commit()
