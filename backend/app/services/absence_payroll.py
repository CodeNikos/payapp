from datetime import date
from decimal import Decimal
from typing import Sequence

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.absence import (
    Absence,
    AbsenceDeductionMode,
    AbsenceStatus,
    AbsenceType,
)
from app.models.employee import Employee


async def get_pending_salary_absences(
    db: AsyncSession,
    employee_id: int,
    period_start: date,
    period_end: date,
) -> list[Absence]:
    """Ausencias injustificadas pendientes de descontar por salario que solapan el período."""
    result = await db.execute(
        select(Absence).where(
            and_(
                Absence.employee_id == employee_id,
                Absence.absence_type == AbsenceType.injustificada,
                Absence.deduction_mode == AbsenceDeductionMode.salario,
                Absence.status == AbsenceStatus.registrada,
                Absence.start_date <= period_end,
                Absence.end_date >= period_start,
            )
        )
    )
    return list(result.scalars().all())


def compute_absence_salary_deduction(
    employee: Employee,
    absences: Sequence[Absence],
) -> Decimal:
    """Descuento = suma(días × salario_mensual / 30)."""
    if not absences:
        return Decimal("0")
    daily = (employee.base_salary / Decimal("30")).quantize(Decimal("0.01"))
    total = Decimal("0")
    for absence in absences:
        total += (daily * Decimal(absence.days)).quantize(Decimal("0.01"))
    return total


async def mark_absences_applied(
    db: AsyncSession,
    absences: Sequence[Absence],
    payroll_id: int,
) -> None:
    for absence in absences:
        absence.status = AbsenceStatus.aplicada
        absence.payroll_id = payroll_id
    if absences:
        await db.flush()
