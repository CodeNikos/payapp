import json
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.employee import Employee, EmployeeStatus
from app.models.payroll import Payroll
from app.models.settlement import Settlement, SettlementReason
from app.models.user import User
from app.models.vacation_usage import VacationUsage
from app.schemas.settlement import (
    SettlementBreakdownResponse,
    SettlementCalculateRequest,
    SettlementCreateRequest,
    SettlementResponse,
)
from app.services.cloudinary_upload import destroy_settlement_notice, upload_settlement_notice
from app.services.settlement import compute_settlement

router = APIRouter()


async def _get_employee(db: AsyncSession, employee_id: int) -> Employee:
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    return employee


async def _get_vacation_usages(db: AsyncSession, employee_id: int) -> list[VacationUsage]:
    result = await db.execute(
        select(VacationUsage).where(VacationUsage.employee_id == employee_id)
    )
    return list(result.scalars().all())


async def _get_payrolls(db: AsyncSession, employee_id: int) -> list[Payroll]:
    result = await db.execute(select(Payroll).where(Payroll.employee_id == employee_id))
    return list(result.scalars().all())


def _to_settlement_response(settlement: Settlement) -> SettlementResponse:
    data = SettlementResponse.model_validate(settlement)
    if settlement.employee:
        data.employee_name = settlement.employee.full_name
    return data


@router.post("/{employee_id}/settlement/preview", response_model=SettlementBreakdownResponse)
async def preview_settlement(
    employee_id: int,
    data: SettlementCalculateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = await _get_employee(db, employee_id)
    try:
        breakdown = compute_settlement(
            employee,
            data.termination_date,
            data.reason,
            await _get_vacation_usages(db, employee_id),
            await _get_payrolls(db, employee_id),
            employer_gave_notice=data.employer_gave_notice,
            employee_gave_notice=data.employee_gave_notice,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return SettlementBreakdownResponse.model_validate(breakdown.to_dict())


@router.post("/{employee_id}/settlement", response_model=SettlementResponse, status_code=201)
async def create_settlement(
    employee_id: int,
    data: SettlementCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    employee = await _get_employee(db, employee_id)
    try:
        breakdown = compute_settlement(
            employee,
            data.termination_date,
            data.reason,
            await _get_vacation_usages(db, employee_id),
            await _get_payrolls(db, employee_id),
            employer_gave_notice=data.employer_gave_notice,
            employee_gave_notice=data.employee_gave_notice,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    settlement = Settlement(
        employee_id=employee.id,
        reason=data.reason,
        termination_date=data.termination_date,
        contract_type=breakdown.contract_type,
        years_of_service=breakdown.years_of_service,
        weekly_salary=breakdown.weekly_salary,
        base_salary=breakdown.base_salary,
        seniority_bonus=breakdown.seniority_bonus,
        vacation_days=breakdown.vacation_days,
        vacation_amount=breakdown.vacation_amount,
        decimo_amount=breakdown.decimo_amount,
        indemnity_amount=breakdown.indemnity_amount,
        employer_notice_amount=breakdown.employer_notice_amount,
        employee_notice_deduction=breakdown.employee_notice_deduction,
        gross_total=breakdown.gross_total,
        net_total=breakdown.net_total,
        employer_gave_notice=data.employer_gave_notice,
        employee_gave_notice=data.employee_gave_notice,
        notes=data.notes or ("; ".join(breakdown.notes) if breakdown.notes else None),
        breakdown_json=json.dumps(breakdown.to_dict(), ensure_ascii=False),
    )
    db.add(settlement)

    if data.apply_termination:
        employee.termination_date = data.termination_date
        employee.is_active = False
        if employee.status == EmployeeStatus.activo:
            employee.status = EmployeeStatus.inactivo

    await db.commit()
    await db.refresh(settlement)

    result = await db.execute(
        select(Settlement)
        .options(selectinload(Settlement.employee))
        .where(Settlement.id == settlement.id)
    )
    return _to_settlement_response(result.scalar_one())


@router.get("/{employee_id}/settlements", response_model=List[SettlementResponse])
async def list_employee_settlements(
    employee_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_employee(db, employee_id)
    result = await db.execute(
        select(Settlement)
        .options(selectinload(Settlement.employee))
        .where(Settlement.employee_id == employee_id)
        .order_by(Settlement.created_at.desc())
    )
    return [_to_settlement_response(s) for s in result.scalars().all()]


@router.post("/settlements/{settlement_id}/notice", response_model=SettlementResponse)
async def upload_settlement_notice_file(
    settlement_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(
        select(Settlement)
        .options(selectinload(Settlement.employee))
        .where(Settlement.id == settlement_id)
    )
    settlement = result.scalar_one_or_none()
    if not settlement:
        raise HTTPException(status_code=404, detail="Liquidación no encontrada")
    if settlement.reason != SettlementReason.renuncia_voluntaria:
        raise HTTPException(
            status_code=400,
            detail="El archivo de preaviso solo aplica a renuncia voluntaria",
        )

    content_type = (file.content_type or "").lower()
    filename = file.filename or "preaviso.pdf"
    allowed = content_type.startswith("image/") or content_type == "application/pdf" or filename.lower().endswith(".pdf")
    if not allowed:
        raise HTTPException(status_code=400, detail="El preaviso debe ser imagen o PDF")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Archivo vacío")
    if len(file_bytes) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="El archivo no puede superar 8 MB")

    try:
        uploaded = upload_settlement_notice(file_bytes, filename)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    if settlement.notice_file_public_id:
        try:
            destroy_settlement_notice(settlement.notice_file_public_id)
        except Exception:
            pass

    settlement.notice_file_url = uploaded["url"]
    settlement.notice_file_public_id = uploaded["public_id"]
    await db.commit()
    await db.refresh(settlement)
    return _to_settlement_response(settlement)
