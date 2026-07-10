from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

from app.models.employee import Employee
from app.models.payroll import Payroll, PayrollStatus, PayrollType


# Períodos de devengado del décimo tercer mes (Panamá).
# `year` en get_cuatrimestre_bounds = año de la fecha de pago.
# 1.ª cuota: 1 dic (año-1) – 31 mar, pago 15 abr
# 2.ª cuota: 1 abr – 31 jul, pago 15 ago
# 3.ª cuota: 1 ago – 30 nov, pago 15 dic


def get_cuatrimestre_bounds(year: int, quarter: int) -> tuple[date, date, date]:
    if quarter == 1:
        period_start = date(year - 1, 12, 1)
        period_end = date(year, 3, 31)
        suggested_payment = date(year, 4, 15)
    elif quarter == 2:
        period_start = date(year, 4, 1)
        period_end = date(year, 7, 31)
        suggested_payment = date(year, 8, 15)
    elif quarter == 3:
        period_start = date(year, 8, 1)
        period_end = date(year, 11, 30)
        suggested_payment = date(year, 12, 15)
    else:
        raise ValueError("Cuatrimestre debe ser 1, 2 o 3")
    return period_start, period_end, suggested_payment


def get_cuatrimestre_for_date(d: date) -> tuple[int, int]:
    month = d.month
    if month in (12, 1, 2, 3):
        payment_year = d.year + 1 if month == 12 else d.year
        return payment_year, 1
    if month in (4, 5, 6, 7):
        return d.year, 2
    return d.year, 3


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


def get_accrual_period(employee: Employee, year: int, quarter: int) -> tuple[date, date]:
    period_start, period_end, _ = get_cuatrimestre_bounds(year, quarter)
    accrual_start = max(period_start, employee.hire_date)
    accrual_end = period_end
    if employee.termination_date and employee.termination_date < accrual_end:
        accrual_end = employee.termination_date
    return accrual_start, accrual_end


def _payroll_overlaps(payroll: Payroll, range_start: date, range_end: date) -> bool:
    return payroll.period_start <= range_end and payroll.period_end >= range_start


def _clip_range(start: date, end: date, clip_start: date, clip_end: date) -> Optional[tuple[date, date]]:
    clipped_start = max(start, clip_start)
    clipped_end = min(end, clip_end)
    if clipped_start > clipped_end:
        return None
    return clipped_start, clipped_end


def aggregate_earnings_from_payrolls(payrolls: list[Payroll]) -> dict[str, Decimal]:
    base = Decimal("0")
    overtime = Decimal("0")
    bonuses = Decimal("0")
    commissions = Decimal("0")
    for p in payrolls:
        base += p.base_salary or Decimal("0")
        overtime += p.overtime_amount or Decimal("0")
        bonuses += p.bonuses or Decimal("0")
        commissions += p.commissions or Decimal("0")
    return {
        "base_salary": base.quantize(Decimal("0.01")),
        "overtime_amount": overtime.quantize(Decimal("0.01")),
        "bonuses": bonuses.quantize(Decimal("0.01")),
        "commissions": commissions.quantize(Decimal("0.01")),
    }


def _merge_ranges(ranges: list[tuple[date, date]]) -> list[tuple[date, date]]:
    if not ranges:
        return []
    sorted_ranges = sorted(ranges, key=lambda r: r[0])
    merged: list[tuple[date, date]] = [sorted_ranges[0]]
    for start, end in sorted_ranges[1:]:
        last_start, last_end = merged[-1]
        if start <= last_end:
            merged[-1] = (last_start, max(last_end, end))
        else:
            merged.append((start, end))
    return merged


def _uncovered_ranges(
    accrual_start: date,
    accrual_end: date,
    covered: list[tuple[date, date]],
) -> list[tuple[date, date]]:
    merged = _merge_ranges(covered)
    if not merged:
        return [(accrual_start, accrual_end)]

    gaps: list[tuple[date, date]] = []
    cursor = accrual_start
    for start, end in merged:
        if cursor < start:
            gap_end = start - timedelta(days=1)
            if gap_end >= cursor:
                gaps.append((cursor, min(gap_end, accrual_end)))
        cursor = max(cursor, end + timedelta(days=1))
    if cursor <= accrual_end:
        gaps.append((cursor, accrual_end))
    return [(s, e) for s, e in gaps if s <= e]


def calculate_missing_base_salary(
    employee: Employee,
    accrual_start: date,
    accrual_end: date,
    covered_ranges: list[tuple[date, date]],
) -> Decimal:
    gaps = _uncovered_ranges(accrual_start, accrual_end, covered_ranges)
    total = Decimal("0")
    for gap_start, gap_end in gaps:
        factor = _period_proration_factor(gap_start, gap_end)
        total += employee.base_salary * factor
    return total.quantize(Decimal("0.01"))


@dataclass
class DecimoBreakdown:
    accrual_start: date
    accrual_end: date
    base_from_payrolls: Decimal
    overtime_from_payrolls: Decimal
    bonuses_from_payrolls: Decimal
    commissions_from_payrolls: Decimal
    projected_base: Decimal
    accrued_total: Decimal
    decimo_amount: Decimal
    is_proportional: bool
    notes: str


def calculate_decimo(
    employee: Employee,
    year: int,
    quarter: int,
    payrolls: list[Payroll],
) -> Optional[DecimoBreakdown]:
    accrual_start, accrual_end = get_accrual_period(employee, year, quarter)
    if accrual_start > accrual_end:
        return None

    cuatrimestre_start, cuatrimestre_end, _ = get_cuatrimestre_bounds(year, quarter)
    is_proportional = (
        employee.hire_date > cuatrimestre_start
        or (employee.termination_date is not None and employee.termination_date < cuatrimestre_end)
    )

    regular_payrolls = [
        p for p in payrolls
        if p.payroll_type == PayrollType.regular
        and p.status != PayrollStatus.anulado
        and _payroll_overlaps(p, accrual_start, accrual_end)
    ]

    earnings = aggregate_earnings_from_payrolls(regular_payrolls)
    covered_ranges = [
        clipped for p in regular_payrolls
        if (clipped := _clip_range(p.period_start, p.period_end, accrual_start, accrual_end))
    ]
    projected_base = calculate_missing_base_salary(employee, accrual_start, accrual_end, covered_ranges)

    accrued_total = (
        earnings["base_salary"]
        + earnings["overtime_amount"]
        + earnings["bonuses"]
        + earnings["commissions"]
        + projected_base
    )
    decimo_amount = (accrued_total / Decimal("12")).quantize(Decimal("0.01"))

    notes_parts: list[str] = []
    if is_proportional:
        if employee.hire_date > cuatrimestre_start:
            notes_parts.append(f"Ingreso {employee.hire_date.isoformat()}")
        if employee.termination_date and employee.termination_date < cuatrimestre_end:
            notes_parts.append(f"Cese {employee.termination_date.isoformat()}")
    if projected_base > 0:
        notes_parts.append(f"Salario base proyectado: B/. {projected_base}")

    return DecimoBreakdown(
        accrual_start=accrual_start,
        accrual_end=accrual_end,
        base_from_payrolls=earnings["base_salary"],
        overtime_from_payrolls=earnings["overtime_amount"],
        bonuses_from_payrolls=earnings["bonuses"],
        commissions_from_payrolls=earnings["commissions"],
        projected_base=projected_base,
        accrued_total=accrued_total.quantize(Decimal("0.01")),
        decimo_amount=decimo_amount,
        is_proportional=is_proportional,
        notes="; ".join(notes_parts) if notes_parts else "",
    )
