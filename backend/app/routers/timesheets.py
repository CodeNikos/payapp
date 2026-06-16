import calendar
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.employee import Employee
from app.models.holiday import Holiday
from app.models.timesheet import TimesheetEntry
from app.models.user import User
from app.schemas.timesheet import (
    TimesheetBulkUpsert,
    TimesheetDayResponse,
    TimesheetValidationResult,
)
from app.services.labor_hours import validate_timesheet_completeness

router = APIRouter()


async def _get_holiday_dates(db: AsyncSession, start: date, end: date) -> set[date]:
    result = await db.execute(
        select(Holiday.holiday_date).where(
            Holiday.holiday_date >= start,
            Holiday.holiday_date <= end,
        )
    )
    return {row[0] for row in result.all()}


@router.get("/", response_model=List[TimesheetDayResponse])
async def list_timesheets(
    employee_id: int = Query(...),
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    period_start = date(year, month, 1)
    last_day = calendar.monthrange(year, month)[1]
    period_end = date(year, month, last_day)

    result = await db.execute(
        select(TimesheetEntry)
        .where(
            TimesheetEntry.employee_id == employee_id,
            TimesheetEntry.work_date >= period_start,
            TimesheetEntry.work_date <= period_end,
        )
        .order_by(TimesheetEntry.work_date)
    )
    return [TimesheetDayResponse.model_validate(e) for e in result.scalars().all()]


@router.put("/bulk", response_model=List[TimesheetDayResponse])
async def upsert_timesheets(
    data: TimesheetBulkUpsert,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    emp_result = await db.execute(
        select(Employee).where(Employee.id == data.employee_id, Employee.is_active == True)
    )
    if not emp_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    saved: list[TimesheetEntry] = []
    for day in data.entries:
        result = await db.execute(
            select(TimesheetEntry).where(
                TimesheetEntry.employee_id == data.employee_id,
                TimesheetEntry.work_date == day.work_date,
            )
        )
        entry = result.scalar_one_or_none()
        payload = day.model_dump()

        has_any = any(payload.get(k) for k in ("clock_in", "clock_out", "overtime_start", "overtime_end"))
        if not has_any:
            if entry:
                await db.delete(entry)
            continue

        if entry:
            for key, value in payload.items():
                if key != "work_date":
                    setattr(entry, key, value)
        else:
            entry = TimesheetEntry(employee_id=data.employee_id, **payload)
            db.add(entry)
        saved.append(entry)

    await db.commit()
    for entry in saved:
        await db.refresh(entry)
    return [TimesheetDayResponse.model_validate(e) for e in saved]


@router.get("/validate", response_model=TimesheetValidationResult)
async def validate_timesheets(
    employee_id: int = Query(...),
    period_start: date = Query(...),
    period_end: date = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if period_end < period_start:
        raise HTTPException(status_code=400, detail="Período inválido")

    emp_result = await db.execute(select(Employee).where(Employee.id == employee_id))
    employee = emp_result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    if employee.is_trusted_staff:
        return TimesheetValidationResult(
            employee_id=employee_id,
            is_complete=True,
            missing_dates=[],
            is_trusted_staff=True,
        )

    holidays = await _get_holiday_dates(db, period_start, period_end)
    ts_result = await db.execute(
        select(TimesheetEntry).where(
            TimesheetEntry.employee_id == employee_id,
            TimesheetEntry.work_date >= period_start,
            TimesheetEntry.work_date <= period_end,
        )
    )
    entries_by_date = {e.work_date: e for e in ts_result.scalars().all()}
    missing = validate_timesheet_completeness(
        employee, entries_by_date, holidays, period_start, period_end
    )

    return TimesheetValidationResult(
        employee_id=employee_id,
        is_complete=len(missing) == 0,
        missing_dates=missing,
        is_trusted_staff=False,
    )
