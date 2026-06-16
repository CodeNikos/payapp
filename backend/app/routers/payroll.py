from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from decimal import Decimal
import calendar
from datetime import date

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.payroll import Payroll, PayrollStatus
from app.models.employee import Employee, effective_weekly_hours
from app.models.holiday import Holiday
from app.models.timesheet import TimesheetEntry
from app.models.user import User
from app.schemas.payroll import PayrollCreate, PayrollReject, PayrollResponse
from app.services.labor_hours import (
    calculate_manual_overtime,
    calculate_overtime_from_timesheets,
    validate_timesheet_completeness,
)

router = APIRouter()

SS_EMPLOYEE_RATE = Decimal("0.0975")
EDUCATIONAL_INSURANCE_RATE = Decimal("0.0125")
ISR_ANNUAL_EXEMPT = Decimal("11000")
ISR_RATE = Decimal("0.15")
ISR_MONTHS = Decimal("13")


def _inclusive_days(start: date, end: date) -> int:
    return (end - start).days + 1


def _period_proration_factor(period_start: date, period_end: date) -> Decimal:
    if period_start.year == period_end.year and period_start.month == period_end.month:
        days_in_month = calendar.monthrange(period_start.year, period_start.month)[1]
        return Decimal(_inclusive_days(period_start, period_end)) / Decimal(days_in_month)

    factor = Decimal("0")
    current = period_start
    while current <= period_end:
        last_day = calendar.monthrange(current.year, current.month)[1]
        month_end = min(period_end, date(current.year, current.month, last_day))
        segment_days = _inclusive_days(current, month_end)
        factor += Decimal(segment_days) / Decimal(last_day)
        if month_end >= period_end:
            break
        current = date(current.year + 1, 1, 1) if current.month == 12 else date(current.year, current.month + 1, 1)
    return factor


def calculate_isr(monthly_salary: Decimal, period_factor: Decimal) -> Decimal:
    annualized = monthly_salary * ISR_MONTHS
    taxable = annualized - ISR_ANNUAL_EXEMPT
    if taxable <= 0:
        return Decimal("0")
    monthly_isr = taxable * ISR_RATE / ISR_MONTHS
    return (monthly_isr * period_factor).quantize(Decimal("0.01"))


def _hourly_rate(employee: Employee) -> Decimal:
    weekly_hours = effective_weekly_hours(employee)
    monthly_hours = weekly_hours * Decimal("52") / Decimal("12")
    if monthly_hours <= 0:
        return Decimal("0")
    return (employee.base_salary / monthly_hours).quantize(Decimal("0.0001"))


async def _get_holiday_dates(db: AsyncSession, start: date, end: date) -> set[date]:
    result = await db.execute(
        select(Holiday.holiday_date).where(
            Holiday.holiday_date >= start,
            Holiday.holiday_date <= end,
        )
    )
    return {row[0] for row in result.all()}


async def _get_timesheet_entries(
    db: AsyncSession,
    employee_id: int,
    period_start: date,
    period_end: date,
) -> list[TimesheetEntry]:
    result = await db.execute(
        select(TimesheetEntry).where(
            TimesheetEntry.employee_id == employee_id,
            TimesheetEntry.work_date >= period_start,
            TimesheetEntry.work_date <= period_end,
        )
    )
    return list(result.scalars().all())


def calculate_payroll(
    employee: Employee,
    data: PayrollCreate,
    timesheet_entries: Optional[list[TimesheetEntry]] = None,
    holidays: Optional[set[date]] = None,
) -> dict:
    full_base = employee.base_salary
    period_factor = _period_proration_factor(data.period_start, data.period_end)
    base = (full_base * period_factor).quantize(Decimal("0.01"))
    hourly = _hourly_rate(employee)

    overtime_hours = Decimal("0")
    overtime_amount = Decimal("0")
    notes_extra: list[str] = []

    if employee.is_trusted_staff:
        overtime_hours, overtime_amount = calculate_manual_overtime(hourly, data.overtime_hours)
    else:
        entries = timesheet_entries or []
        holidays = holidays or set()
        entries_by_date = {e.work_date: e for e in entries}
        missing = validate_timesheet_completeness(
            employee, entries_by_date, holidays, data.period_start, data.period_end
        )
        if missing:
            raise ValueError(
                f"Marcaciones incompletas en: {', '.join(missing[:5])}"
                + (f" y {len(missing) - 5} más" if len(missing) > 5 else "")
            )
        ot_result = calculate_overtime_from_timesheets(hourly, entries)
        overtime_hours = ot_result.total_hours
        overtime_amount = ot_result.total_amount
        notes_extra.extend(ot_result.warnings)

    gross = base + overtime_amount + data.bonuses

    social_security = (gross * SS_EMPLOYEE_RATE).quantize(Decimal("0.01"))
    educational_insurance = (gross * EDUCATIONAL_INSURANCE_RATE).quantize(Decimal("0.01"))
    income_tax = calculate_isr(full_base, period_factor)
    total_deductions = social_security + educational_insurance + income_tax
    net = gross - total_deductions - data.other_deductions

    notes = data.notes
    if notes_extra:
        warning_text = " | ".join(notes_extra)
        notes = f"{notes}\n[Horas extra] {warning_text}".strip() if notes else f"[Horas extra] {warning_text}"

    return {
        "base_salary": base,
        "overtime_hours": overtime_hours,
        "overtime_amount": overtime_amount,
        "bonuses": data.bonuses,
        "gross_salary": gross.quantize(Decimal("0.01")),
        "social_security": social_security,
        "educational_insurance": educational_insurance,
        "income_tax": income_tax,
        "other_deductions": data.other_deductions,
        "total_deductions": total_deductions.quantize(Decimal("0.01")),
        "net_salary": net.quantize(Decimal("0.01")),
        "notes": notes,
    }


@router.get("/", response_model=List[PayrollResponse])
async def list_payrolls(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    employee_id: Optional[int] = None,
    status: Optional[PayrollStatus] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Payroll)
    if employee_id:
        query = query.where(Payroll.employee_id == employee_id)
    if status:
        query = query.where(Payroll.status == status)
    result = await db.execute(query.offset(skip).limit(limit).order_by(Payroll.created_at.desc()))
    return [PayrollResponse.model_validate(p) for p in result.scalars().all()]


@router.post("/", response_model=PayrollResponse, status_code=201)
async def create_payroll(
    data: PayrollCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Employee).where(Employee.id == data.employee_id, Employee.is_active == True))
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    holidays: set[date] = set()
    timesheet_entries: list[TimesheetEntry] = []
    if not employee.is_trusted_staff:
        holidays = await _get_holiday_dates(db, data.period_start, data.period_end)
        timesheet_entries = await _get_timesheet_entries(
            db, data.employee_id, data.period_start, data.period_end
        )

    try:
        calcs = calculate_payroll(employee, data, timesheet_entries, holidays)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    notes = calcs.pop("notes", data.notes)
    payroll = Payroll(
        employee_id=data.employee_id,
        period_start=data.period_start,
        period_end=data.period_end,
        notes=notes,
        created_by=current_user.id,
        **calcs,
    )
    db.add(payroll)
    await db.commit()
    await db.refresh(payroll)
    return PayrollResponse.model_validate(payroll)


@router.patch("/{payroll_id}/approve", response_model=PayrollResponse)
async def approve_payroll(
    payroll_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(Payroll).where(Payroll.id == payroll_id))
    payroll = result.scalar_one_or_none()
    if not payroll:
        raise HTTPException(status_code=404, detail="Nómina no encontrada")
    if payroll.status != PayrollStatus.borrador:
        raise HTTPException(status_code=400, detail="Solo se puede aprobar una nómina en borrador")
    payroll.status = PayrollStatus.procesado
    await db.commit()
    await db.refresh(payroll)
    return PayrollResponse.model_validate(payroll)


@router.patch("/{payroll_id}/reject", response_model=PayrollResponse)
async def reject_payroll(
    payroll_id: int,
    data: PayrollReject = PayrollReject(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(Payroll).where(Payroll.id == payroll_id))
    payroll = result.scalar_one_or_none()
    if not payroll:
        raise HTTPException(status_code=404, detail="Nómina no encontrada")
    if payroll.status in (PayrollStatus.pagado, PayrollStatus.anulado):
        raise HTTPException(status_code=400, detail="No se puede rechazar una nómina pagada o ya rechazada")
    payroll.status = PayrollStatus.anulado
    if data.reason:
        rejection_note = f"[Rechazada] {data.reason.strip()}"
        payroll.notes = f"{payroll.notes}\n{rejection_note}".strip() if payroll.notes else rejection_note
    await db.commit()
    await db.refresh(payroll)
    return PayrollResponse.model_validate(payroll)


@router.delete("/{payroll_id}", status_code=204)
async def delete_payroll(
    payroll_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Payroll).where(Payroll.id == payroll_id))
    payroll = result.scalar_one_or_none()
    if not payroll:
        raise HTTPException(status_code=404, detail="Nómina no encontrada")
    if payroll.status != PayrollStatus.borrador:
        raise HTTPException(status_code=400, detail="Solo se pueden eliminar nóminas en borrador")
    await db.delete(payroll)
    await db.commit()
