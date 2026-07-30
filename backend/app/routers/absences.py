from datetime import date
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.absence import (
    Absence,
    AbsenceDeductionMode,
    AbsenceStatus,
    AbsenceType,
    JUSTIFIED_TYPES,
)
from app.models.employee import Employee
from app.models.user import User
from app.models.vacation_usage import VacationUsage
from app.schemas.absence import AbsenceCreate, AbsenceResponse, AbsenceUpdate
from app.services.cloudinary_upload import destroy_absence_evidence, upload_absence_evidence
from app.services.vacation import (
    compute_vacation_balance,
    compute_vacation_end_date,
    compute_vacation_payment,
)

router = APIRouter()

def _is_justified(absence_type: AbsenceType) -> bool:
    return absence_type in JUSTIFIED_TYPES


def _to_response(absence: Absence) -> AbsenceResponse:
    data = AbsenceResponse.model_validate(absence)
    if absence.employee:
        data.employee_name = absence.employee.full_name
    return data


async def _get_usages(db: AsyncSession, employee_id: int) -> list[VacationUsage]:
    result = await db.execute(
        select(VacationUsage).where(VacationUsage.employee_id == employee_id)
    )
    return list(result.scalars().all())


async def _create_vacation_usage_for_absence(
    db: AsyncSession,
    employee: Employee,
    start_date: date,
    days: Decimal,
    comments: Optional[str],
) -> VacationUsage:
    usages = await _get_usages(db, employee.id)
    balance = compute_vacation_balance(employee, usages, start_date)
    if days > balance:
        raise HTTPException(
            status_code=400,
            detail=f"Días solicitados ({days}) superan el saldo de vacaciones ({balance})",
        )
    end_date = compute_vacation_end_date(start_date, days)
    amount = compute_vacation_payment(employee.base_salary, days)
    usage = VacationUsage(
        employee_id=employee.id,
        start_date=start_date,
        end_date=end_date,
        usage_date=start_date,
        days=days,
        amount=amount,
        notes=comments or "Descuento por ausencia injustificada",
    )
    db.add(usage)
    await db.flush()
    return usage


@router.get("/", response_model=List[AbsenceResponse])
async def list_absences(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    employee_id: Optional[int] = None,
    absence_type: Optional[AbsenceType] = None,
    status: Optional[AbsenceStatus] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Absence).options(selectinload(Absence.employee))
    if employee_id:
        query = query.where(Absence.employee_id == employee_id)
    if absence_type:
        query = query.where(Absence.absence_type == absence_type)
    if status:
        query = query.where(Absence.status == status)
    if date_from:
        query = query.where(Absence.end_date >= date_from)
    if date_to:
        query = query.where(Absence.start_date <= date_to)

    result = await db.execute(
        query.order_by(Absence.start_date.desc()).offset(skip).limit(limit)
    )
    return [_to_response(a) for a in result.scalars().all()]


@router.post("/", response_model=AbsenceResponse, status_code=201)
async def create_absence(
    data: AbsenceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(Employee).where(Employee.id == data.employee_id))
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    is_justified = _is_justified(data.absence_type)
    vacation_usage_id = None

    if (
        not is_justified
        and data.deduction_mode == AbsenceDeductionMode.vacaciones
    ):
        usage = await _create_vacation_usage_for_absence(
            db, employee, data.start_date, data.days, data.comments
        )
        vacation_usage_id = usage.id

    absence = Absence(
        employee_id=data.employee_id,
        absence_type=data.absence_type,
        start_date=data.start_date,
        end_date=data.end_date,
        days=data.days,
        is_justified=is_justified,
        deduction_mode=data.deduction_mode if not is_justified else None,
        comments=(data.comments or "").strip() or None,
        vacation_usage_id=vacation_usage_id,
        status=AbsenceStatus.registrada,
    )
    db.add(absence)
    await db.commit()

    result = await db.execute(
        select(Absence)
        .options(selectinload(Absence.employee))
        .where(Absence.id == absence.id)
    )
    return _to_response(result.scalar_one())


@router.get("/{absence_id}", response_model=AbsenceResponse)
async def get_absence(
    absence_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Absence)
        .options(selectinload(Absence.employee))
        .where(Absence.id == absence_id)
    )
    absence = result.scalar_one_or_none()
    if not absence:
        raise HTTPException(status_code=404, detail="Ausencia no encontrada")
    return _to_response(absence)


@router.patch("/{absence_id}", response_model=AbsenceResponse)
async def update_absence(
    absence_id: int,
    data: AbsenceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(
        select(Absence)
        .options(selectinload(Absence.employee))
        .where(Absence.id == absence_id)
    )
    absence = result.scalar_one_or_none()
    if not absence:
        raise HTTPException(status_code=404, detail="Ausencia no encontrada")
    if absence.status == AbsenceStatus.aplicada:
        raise HTTPException(status_code=400, detail="No se puede editar una ausencia ya aplicada en nómina")
    if absence.status == AbsenceStatus.anulada:
        raise HTTPException(status_code=400, detail="La ausencia está anulada")

    updates = data.model_dump(exclude_unset=True)
    absence_type = updates.get("absence_type", absence.absence_type)
    start_date = updates.get("start_date", absence.start_date)
    end_date = updates.get("end_date", absence.end_date)
    days = updates.get("days", absence.days)
    comments = updates.get("comments", absence.comments)
    deduction_mode = updates.get("deduction_mode", absence.deduction_mode)

    if end_date < start_date:
        raise HTTPException(status_code=400, detail="La fecha fin no puede ser anterior a la fecha inicio")

    is_justified = _is_justified(absence_type)
    if absence_type == AbsenceType.injustificada and not deduction_mode:
        raise HTTPException(status_code=400, detail="Indica el modo de descuento para ausencias injustificadas")
    if is_justified:
        deduction_mode = None
    if absence_type == AbsenceType.otros and not (comments or "").strip():
        raise HTTPException(status_code=400, detail="Los comentarios son obligatorios para el tipo Otros")

    # Manejo de vacation_usage al cambiar modo
    if (
        not is_justified
        and deduction_mode == AbsenceDeductionMode.vacaciones
        and not absence.vacation_usage_id
    ):
        emp_result = await db.execute(select(Employee).where(Employee.id == absence.employee_id))
        employee = emp_result.scalar_one()
        usage = await _create_vacation_usage_for_absence(
            db, employee, start_date, days, comments
        )
        absence.vacation_usage_id = usage.id
    elif (
        (is_justified or deduction_mode != AbsenceDeductionMode.vacaciones)
        and absence.vacation_usage_id
    ):
        usage_result = await db.execute(
            select(VacationUsage).where(VacationUsage.id == absence.vacation_usage_id)
        )
        usage = usage_result.scalar_one_or_none()
        if usage:
            await db.delete(usage)
        absence.vacation_usage_id = None

    absence.absence_type = absence_type
    absence.start_date = start_date
    absence.end_date = end_date
    absence.days = days
    absence.is_justified = is_justified
    absence.deduction_mode = deduction_mode
    absence.comments = (comments or "").strip() or None

    await db.commit()
    result = await db.execute(
        select(Absence)
        .options(selectinload(Absence.employee))
        .where(Absence.id == absence_id)
    )
    return _to_response(result.scalar_one())


@router.post("/{absence_id}/evidence", response_model=AbsenceResponse)
async def upload_evidence(
    absence_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(
        select(Absence)
        .options(selectinload(Absence.employee))
        .where(Absence.id == absence_id)
    )
    absence = result.scalar_one_or_none()
    if not absence:
        raise HTTPException(status_code=404, detail="Ausencia no encontrada")
    if absence.status == AbsenceStatus.anulada:
        raise HTTPException(status_code=400, detail="La ausencia está anulada")
    if not absence.is_justified:
        raise HTTPException(status_code=400, detail="Solo las ausencias justificadas requieren evidencia")

    content_type = (file.content_type or "").lower()
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="La evidencia debe ser una imagen")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Archivo vacío")
    if len(file_bytes) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="La imagen no puede superar 8 MB")

    try:
        uploaded = upload_absence_evidence(file_bytes, file.filename or "evidence.jpg")
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Error al subir a Cloudinary: {exc}") from exc

    if absence.evidence_public_id:
        try:
            destroy_absence_evidence(absence.evidence_public_id)
        except Exception:
            pass

    absence.evidence_url = uploaded["url"]
    absence.evidence_public_id = uploaded["public_id"]
    await db.commit()

    result = await db.execute(
        select(Absence)
        .options(selectinload(Absence.employee))
        .where(Absence.id == absence_id)
    )
    return _to_response(result.scalar_one())


@router.delete("/{absence_id}", status_code=204)
async def cancel_absence(
    absence_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(Absence).where(Absence.id == absence_id))
    absence = result.scalar_one_or_none()
    if not absence:
        raise HTTPException(status_code=404, detail="Ausencia no encontrada")
    if absence.status == AbsenceStatus.aplicada:
        raise HTTPException(
            status_code=400,
            detail="No se puede anular una ausencia ya aplicada en nómina",
        )

    if absence.vacation_usage_id:
        usage_result = await db.execute(
            select(VacationUsage).where(VacationUsage.id == absence.vacation_usage_id)
        )
        usage = usage_result.scalar_one_or_none()
        if usage:
            await db.delete(usage)
        absence.vacation_usage_id = None

    if absence.evidence_public_id:
        try:
            destroy_absence_evidence(absence.evidence_public_id)
        except Exception:
            pass
        absence.evidence_public_id = None
        absence.evidence_url = None

    absence.status = AbsenceStatus.anulada
    await db.commit()
