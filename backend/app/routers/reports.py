from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from datetime import date
from decimal import Decimal
from io import BytesIO

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.employee import Employee
from app.models.user import User
from app.models.vacation_usage import VacationUsage
from app.schemas.vacation import (
    VacationReportItem,
    VacationReportResponse,
    VacationTakenReportItem,
    VacationTakenReportResponse,
    VacationUsageCreate,
    VacationUsageUpdate,
    VacationUsageResponse,
    VacationDetailResponse,
)
from app.schemas.sipe import SipeReportPreviewResponse, SipeReportRow
from app.services.vacation import (
    compute_vacation_balance,
    compute_vacation_balance_cutoff,
    compute_vacation_end_date,
    compute_vacation_payment,
)
from app.services.sipe_report import build_sipe_rows, rows_to_workbook_bytes, sipe_filename

router = APIRouter()


def _inclusive_days(start: date, end: date) -> Decimal:
    return Decimal((end - start).days + 1)


def _resolve_usage_days(data: VacationUsageCreate) -> Decimal | None:
    if data.days is not None:
        return data.days
    if data.end_date is not None:
        return _inclusive_days(data.start_date, data.end_date)
    return None


@router.get("/vacations/taken", response_model=VacationTakenReportResponse)
async def vacation_taken_report(
    employee_id: Optional[int] = None,
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(VacationUsage, Employee)
        .join(Employee, VacationUsage.employee_id == Employee.id)
        .order_by(VacationUsage.start_date.desc(), Employee.last_name, Employee.first_name)
    )
    if employee_id:
        query = query.where(VacationUsage.employee_id == employee_id)
    if from_date:
        query = query.where(VacationUsage.end_date >= from_date)
    if to_date:
        query = query.where(VacationUsage.start_date <= to_date)

    result = await db.execute(query)
    items: list[VacationTakenReportItem] = []
    needs_commit = False
    for usage, employee in result.all():
        end_date = compute_vacation_end_date(usage.start_date, usage.days)
        if usage.end_date != end_date:
            usage.end_date = end_date
            needs_commit = True
        items.append(VacationTakenReportItem(
            id=usage.id,
            employee_id=employee.id,
            employee_name=employee.full_name,
            document_id=employee.document_id,
            start_date=usage.start_date,
            end_date=end_date,
            days=usage.days,
            amount=usage.amount,
            base_salary=employee.base_salary,
            notes=usage.notes,
        ))
    if needs_commit:
        await db.commit()
    return VacationTakenReportResponse(items=items)


async def _get_usages_for_employee(db: AsyncSession, employee_id: int) -> list[VacationUsage]:
    result = await db.execute(
        select(VacationUsage)
        .where(VacationUsage.employee_id == employee_id)
        .order_by(VacationUsage.usage_date.desc())
    )
    return list(result.scalars().all())


def _build_report_item(employee: Employee, usages: list[VacationUsage], as_of: date) -> VacationReportItem:
    balance = compute_vacation_balance(employee, usages, as_of)
    return VacationReportItem(
        employee_id=employee.id,
        employee_name=employee.full_name,
        document_id=employee.document_id,
        hire_date=employee.hire_date,
        base_salary=employee.base_salary,
        accumulated_days=balance,
        vacation_opening_balance=employee.vacation_opening_balance or Decimal("0"),
        vacation_opening_balance_date=compute_vacation_balance_cutoff(employee.hire_date, as_of),
    )


@router.get("/vacations", response_model=VacationReportResponse)
async def vacation_report(
    as_of: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    as_of_date = as_of or date.today()
    result = await db.execute(
        select(Employee).where(Employee.is_active == True).order_by(Employee.last_name, Employee.first_name)
    )
    employees = list(result.scalars().all())

    items: list[VacationReportItem] = []
    for employee in employees:
        usages = await _get_usages_for_employee(db, employee.id)
        items.append(_build_report_item(employee, usages, as_of_date))

    return VacationReportResponse(as_of=as_of_date, items=items)


@router.get("/vacations/{employee_id}", response_model=VacationDetailResponse)
async def vacation_detail(
    employee_id: int,
    as_of: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    as_of_date = as_of or date.today()
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    usages = await _get_usages_for_employee(db, employee_id)
    balance = compute_vacation_balance(employee, usages, as_of_date)

    return VacationDetailResponse(
        employee_id=employee.id,
        employee_name=employee.full_name,
        document_id=employee.document_id,
        hire_date=employee.hire_date,
        base_salary=employee.base_salary,
        accumulated_days=balance,
        vacation_opening_balance=employee.vacation_opening_balance or Decimal("0"),
        vacation_opening_balance_date=compute_vacation_balance_cutoff(employee.hire_date, as_of_date),
        usages=[VacationUsageResponse.model_validate(u) for u in usages],
        as_of=as_of_date,
    )


@router.post("/vacations/usages", response_model=VacationUsageResponse, status_code=201)
async def register_vacation_usage(
    data: VacationUsageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Employee).where(Employee.id == data.employee_id))
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    usages = await _get_usages_for_employee(db, data.employee_id)
    balance = compute_vacation_balance(employee, usages, data.start_date)

    days = _resolve_usage_days(data)
    if days is None or days <= 0:
        raise HTTPException(status_code=400, detail="Indica los días de vacaciones")

    if days > balance:
        raise HTTPException(
            status_code=400,
            detail=f"Días solicitados ({days}) superan el saldo acumulado ({balance})",
        )

    end_date = compute_vacation_end_date(data.start_date, days)
    amount = compute_vacation_payment(employee.base_salary, days)
    usage = VacationUsage(
        employee_id=data.employee_id,
        start_date=data.start_date,
        end_date=end_date,
        usage_date=data.start_date,
        days=days,
        amount=amount,
        notes=data.notes,
    )
    db.add(usage)
    await db.commit()
    await db.refresh(usage)
    return VacationUsageResponse.model_validate(usage)


@router.patch("/vacations/usages/{usage_id}", response_model=VacationUsageResponse)
async def update_vacation_usage(
    usage_id: int,
    data: VacationUsageUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(VacationUsage).where(VacationUsage.id == usage_id))
    usage = result.scalar_one_or_none()
    if not usage:
        raise HTTPException(status_code=404, detail="Registro de vacaciones no encontrado")

    emp_result = await db.execute(select(Employee).where(Employee.id == usage.employee_id))
    employee = emp_result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    start_date = data.start_date if data.start_date is not None else usage.start_date
    days = data.days
    if days is None and data.end_date is not None:
        days = _inclusive_days(start_date, data.end_date)
    if days is None:
        days = usage.days

    usages = await _get_usages_for_employee(db, usage.employee_id)
    other_usages = [u for u in usages if u.id != usage.id]
    balance = compute_vacation_balance(employee, other_usages, start_date)

    if days > balance:
        raise HTTPException(
            status_code=400,
            detail=f"Días solicitados ({days}) superan el saldo disponible ({balance})",
        )

    usage.start_date = start_date
    usage.usage_date = start_date
    usage.days = days
    usage.end_date = compute_vacation_end_date(start_date, days)
    usage.amount = compute_vacation_payment(employee.base_salary, days)
    if data.notes is not None:
        usage.notes = data.notes.strip() or None

    await db.commit()
    await db.refresh(usage)
    return VacationUsageResponse.model_validate(usage)


@router.delete("/vacations/usages/{usage_id}", status_code=204)
async def delete_vacation_usage(
    usage_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(VacationUsage).where(VacationUsage.id == usage_id))
    usage = result.scalar_one_or_none()
    if not usage:
        raise HTTPException(status_code=404, detail="Registro de vacaciones no encontrado")
    await db.delete(usage)
    await db.commit()


def _sipe_rows_to_response(year: int, month: int, rows) -> SipeReportPreviewResponse:
    warnings = []
    missing = [r for r in rows if r.missing_nss]
    if missing:
        names = ", ".join(f"{r.first_name} {r.last_name}" for r in missing[:5])
        extra = f" y {len(missing) - 5} más" if len(missing) > 5 else ""
        warnings.append(
            f"{len(missing)} empleado(s) sin Número de Seguro Social: {names}{extra}."
        )
    items = [
        SipeReportRow(
            employee_id=r.employee_id,
            document_type=r.document_type,
            document_id=r.document_id,
            social_security_number=r.social_security_number or "0",
            first_name=r.first_name,
            last_name=r.last_name,
            sueldo=r.sueldo,
            horas_extras=r.horas_extras,
            impuesto_renta=r.impuesto_renta,
            decimo=r.decimo,
            vacaciones=r.vacaciones,
            comisiones=r.comisiones,
            bonificaciones=r.bonificaciones,
            combustible=r.combustible,
            dieta=r.dieta,
            salario_especie=r.salario_especie,
            viaticos=r.viaticos,
            gasto_representacion=r.gasto_representacion,
            isr_gasto_representacion=r.isr_gasto_representacion,
            decimo_gasto_representacion=r.decimo_gasto_representacion,
            primas_produccion=r.primas_produccion,
            dividendo=r.dividendo,
            participacion_beneficios=r.participacion_beneficios,
            gratificacion=r.gratificacion,
            preaviso=r.preaviso,
            indemnizacion=r.indemnizacion,
            missing_nss=r.missing_nss,
        )
        for r in rows
    ]
    return SipeReportPreviewResponse(year=year, month=month, items=items, warnings=warnings)


@router.get("/sipe/preview", response_model=SipeReportPreviewResponse)
async def sipe_preview(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = await build_sipe_rows(db, year, month)
    return _sipe_rows_to_response(year, month, rows)


@router.get("/sipe")
async def sipe_download(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = await build_sipe_rows(db, year, month)
    content = rows_to_workbook_bytes(rows)
    filename = sipe_filename(year, month)
    return StreamingResponse(
        BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
