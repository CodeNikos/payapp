"""Resolución de descuentos recurrentes para un período de nómina."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Iterable

from app.models.recurring_deduction import DeductionFrequency, EmployeeRecurringDeduction


@dataclass
class DeductionLine:
    concept: str
    amount: Decimal
    source: str  # manual | recurring | absence

    def to_dict(self) -> dict:
        return {
            "concept": self.concept,
            "amount": float(self.amount.quantize(Decimal("0.01"))),
            "source": self.source,
        }


def detect_quincena(period_end: date) -> int:
    """1 = primera quincena (fin <= 15), 2 = segunda."""
    return 1 if period_end.day <= 15 else 2


def is_active_in_period(
    deduction: EmployeeRecurringDeduction,
    period_start: date,
    period_end: date,
) -> bool:
    if not deduction.is_active:
        return False
    if deduction.start_date > period_end:
        return False
    if deduction.end_date is not None and deduction.end_date < period_start:
        return False
    return True


def resolve_amount_for_period(
    deduction: EmployeeRecurringDeduction,
    period_end: date,
) -> Decimal | None:
    """Devuelve el monto a aplicar en esta quincena, o None si no aplica."""
    quincena = detect_quincena(period_end)
    amount = Decimal(str(deduction.amount or 0))
    if amount <= 0:
        return None

    if deduction.frequency == DeductionFrequency.quincenal:
        return (amount / Decimal("2")).quantize(Decimal("0.01"))

    # mensual: solo en la quincena configurada
    if deduction.monthly_quincena == quincena:
        return amount.quantize(Decimal("0.01"))
    return None


def resolve_for_period(
    deductions: Iterable[EmployeeRecurringDeduction],
    period_start: date,
    period_end: date,
) -> list[DeductionLine]:
    lines: list[DeductionLine] = []
    for d in deductions:
        if not is_active_in_period(d, period_start, period_end):
            continue
        amount = resolve_amount_for_period(d, period_end)
        if amount is None or amount <= 0:
            continue
        lines.append(
            DeductionLine(
                concept=d.concept,
                amount=amount,
                source="recurring",
            )
        )
    return lines


def sum_lines(lines: Iterable[DeductionLine]) -> Decimal:
    total = Decimal("0")
    for line in lines:
        total += line.amount
    return total.quantize(Decimal("0.01"))
