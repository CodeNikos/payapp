from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import date
from decimal import Decimal
from typing import Optional

from app.models.employee import ContractType, Employee
from app.models.payroll import Payroll
from app.models.settlement import SettlementReason
from app.models.vacation_usage import VacationUsage
from app.services.decimo import calculate_decimo, get_cuatrimestre_for_date
from app.services.vacation import compute_vacation_balance, compute_vacation_payment

DAYS_IN_MONTH = Decimal("30")
# Salario semanal = salario mensual × (12 / 52)
WEEKS_PER_YEAR = Decimal("52")
MONTHS_PER_YEAR = Decimal("12")
INDEMNITY_RATE_FIRST_10 = Decimal("3.4")
INDEMNITY_RATE_AFTER_10 = Decimal("1")


@dataclass
class SettlementBreakdown:
    employee_id: int
    employee_name: str
    document_id: str
    hire_date: date
    termination_date: date
    reason: SettlementReason
    contract_type: str
    base_salary: Decimal
    weekly_salary: Decimal
    years_of_service: Decimal

    seniority_bonus: Decimal
    vacation_days: Decimal
    vacation_amount: Decimal
    decimo_amount: Decimal
    decimo_period_label: str
    indemnity_amount: Decimal
    employer_notice_amount: Decimal
    employee_notice_deduction: Decimal

    employer_gave_notice: Optional[bool]
    employee_gave_notice: Optional[bool]

    gross_total: Decimal
    net_total: Decimal
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        data = asdict(self)
        data["reason"] = self.reason.value
        for key, value in list(data.items()):
            if isinstance(value, Decimal):
                data[key] = str(value)
            elif isinstance(value, date):
                data[key] = value.isoformat()
        return data


def weekly_salary(base_salary: Decimal) -> Decimal:
    """Salario semanal = salario mensual × (12 / 52)."""
    if base_salary <= 0:
        return Decimal("0.00")
    return (base_salary * MONTHS_PER_YEAR / WEEKS_PER_YEAR).quantize(Decimal("0.01"))


def years_of_service(hire_date: date, termination_date: date) -> Decimal:
    """
    Años de servicio = días laborados / 365.
    Usado para indemnización y visualización.
    """
    if termination_date < hire_date:
        return Decimal("0")
    days = (termination_date - hire_date).days
    if days <= 0:
        return Decimal("0")
    return (Decimal(days) / Decimal("365")).quantize(Decimal("0.0001"))


def months_of_service(hire_date: date, termination_date: date) -> Decimal:
    """Meses totales entre fecha de ingreso y fecha de cese."""
    if termination_date < hire_date:
        return Decimal("0")
    months = (termination_date.year - hire_date.year) * 12 + (
        termination_date.month - hire_date.month
    )
    if termination_date.day < hire_date.day:
        months -= 1
    return Decimal(max(months, 0))


def calculate_seniority_bonus(base: Decimal, months: Decimal) -> Decimal:
    """
    Prima de antigüedad = salario semanal × (meses totales trabajados / 12)
    salario semanal = salario mensual × (12 / 52)
    """
    if base <= 0 or months <= 0:
        return Decimal("0.00")
    week = base * MONTHS_PER_YEAR / WEEKS_PER_YEAR
    return (week * (months / MONTHS_PER_YEAR)).quantize(Decimal("0.01"))


def calculate_indemnity(base: Decimal, years: Decimal) -> Decimal:
    """
    Indemnización por despido injustificado:
    - Primeros 10 años: 3.4 semanas por año
    - A partir del año 11: 1 semana por año adicional
    """
    if years <= 0:
        return Decimal("0.00")
    week = weekly_salary(base)
    first = min(years, Decimal("10"))
    rest = max(years - Decimal("10"), Decimal("0"))
    amount = (first * INDEMNITY_RATE_FIRST_10 * week) + (rest * INDEMNITY_RATE_AFTER_10 * week)
    return amount.quantize(Decimal("0.01"))


def _decimo_for_termination(
    employee: Employee,
    termination_date: date,
    payrolls: list[Payroll],
) -> tuple[Decimal, str]:
    original = employee.termination_date
    employee.termination_date = termination_date
    try:
        year, quarter = get_cuatrimestre_for_date(termination_date)
        breakdown = calculate_decimo(employee, year, quarter, payrolls)
        if not breakdown:
            return Decimal("0.00"), f"Cuatrimestre {quarter}/{year} sin período devengable"
        label = f"{quarter}.ª cuota {year} ({breakdown.accrual_start} → {breakdown.accrual_end})"
        return breakdown.decimo_amount, label
    finally:
        employee.termination_date = original


def compute_settlement(
    employee: Employee,
    termination_date: date,
    reason: SettlementReason,
    vacation_usages: list[VacationUsage],
    payrolls: list[Payroll],
    *,
    employer_gave_notice: Optional[bool] = None,
    employee_gave_notice: Optional[bool] = None,
) -> SettlementBreakdown:
    if termination_date < employee.hire_date:
        raise ValueError("La fecha de cese no puede ser anterior a la fecha de ingreso")

    base = Decimal(employee.base_salary or 0)
    week = weekly_salary(base)
    years = years_of_service(employee.hire_date, termination_date)
    months = months_of_service(employee.hire_date, termination_date)
    notes: list[str] = []

    seniority = calculate_seniority_bonus(base, months)
    notes.append(
        f"Prima: salario semanal B/. {week} × ({months} meses / 12)"
    )
    vacation_days = compute_vacation_balance(employee, vacation_usages, termination_date)
    if vacation_days < 0:
        vacation_days = Decimal("0")
    vacation_amount = compute_vacation_payment(base, vacation_days)
    decimo_amount, decimo_label = _decimo_for_termination(employee, termination_date, payrolls)

    indemnity = Decimal("0.00")
    employer_notice = Decimal("0.00")
    employee_deduction = Decimal("0.00")

    is_indefinido = employee.contract_type == ContractType.indefinido

    if reason == SettlementReason.despido_injustificado:
        indemnity = calculate_indemnity(base, years)
        notes.append("Incluye indemnización por despido injustificado")
        if is_indefinido:
            if employer_gave_notice is False:
                employer_notice = base.quantize(Decimal("0.01"))
                notes.append("Sin preaviso del empleador: se paga 1 mes de salario")
            elif employer_gave_notice is True:
                notes.append("Empleador dio preaviso: no se paga mes de preaviso")
            else:
                notes.append("Indica si el empleador dio preaviso para calcular el mes de preaviso")
        else:
            notes.append("Preaviso de 1 mes aplica solo a contratos indefinidos")
    elif reason == SettlementReason.despido_justificado:
        notes.append("Despido justificado: sin indemnización ni preaviso pagadero")
    elif reason == SettlementReason.renuncia_voluntaria:
        notes.append("Renuncia voluntaria: sin indemnización")
        if is_indefinido:
            if employee_gave_notice is False:
                employee_deduction = week
                notes.append(
                    "Sin preaviso del trabajador (15 días): se descuenta 1 semana de salario"
                )
            elif employee_gave_notice is True:
                notes.append("Trabajador dio preaviso de 15 días: sin descuento")
            else:
                notes.append("Indica si el trabajador dio preaviso para aplicar o no el descuento")
        else:
            notes.append("Descuento por falta de preaviso aplica en contratos indefinidos")

    gross = (
        seniority
        + vacation_amount
        + decimo_amount
        + indemnity
        + employer_notice
    ).quantize(Decimal("0.01"))
    net = (gross - employee_deduction).quantize(Decimal("0.01"))

    return SettlementBreakdown(
        employee_id=employee.id,
        employee_name=employee.full_name,
        document_id=employee.document_id,
        hire_date=employee.hire_date,
        termination_date=termination_date,
        reason=reason,
        contract_type=employee.contract_type.value if employee.contract_type else "indefinido",
        base_salary=base.quantize(Decimal("0.01")),
        weekly_salary=week,
        years_of_service=years,
        seniority_bonus=seniority,
        vacation_days=vacation_days.quantize(Decimal("0.01")),
        vacation_amount=vacation_amount,
        decimo_amount=decimo_amount,
        decimo_period_label=decimo_label,
        indemnity_amount=indemnity,
        employer_notice_amount=employer_notice,
        employee_notice_deduction=employee_deduction,
        employer_gave_notice=employer_gave_notice,
        employee_gave_notice=employee_gave_notice,
        gross_total=gross,
        net_total=net,
        notes=notes,
    )
