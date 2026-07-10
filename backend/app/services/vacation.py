from __future__ import annotations

import calendar
import math
from datetime import date, timedelta
from decimal import Decimal
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.employee import Employee
    from app.models.vacation_usage import VacationUsage

DAYS_PER_MONTH_FACTOR = Decimal("30") / Decimal("11")
DAYS_IN_MONTH = Decimal("30")


def compute_vacation_balance_cutoff(hire_date: date, reference: date | None = None) -> date:
    """Fecha de corte: día y mes de ingreso, año = año de referencia + 1."""
    ref = reference or date.today()
    year = ref.year + 1
    last_day = calendar.monthrange(year, hire_date.month)[1]
    return date(year, hire_date.month, min(hire_date.day, last_day))


def get_vacation_accrual_cursor(employee: "Employee", as_of: date) -> date:
    if (employee.vacation_opening_balance or Decimal("0")) > 0:
        return compute_vacation_balance_cutoff(employee.hire_date, as_of)
    return employee.hire_date


def _inclusive_days(start: date, end: date) -> int:
    return (end - start).days + 1


def months_between(start: date, end: date) -> Decimal:
    if end < start:
        return Decimal("0")
    days = Decimal(_inclusive_days(start, end))
    return (days / DAYS_IN_MONTH).quantize(Decimal("0.0001"))


def accrue_days(start: date, end: date) -> Decimal:
    if end < start:
        return Decimal("0")
    months = months_between(start, end)
    return (months * DAYS_PER_MONTH_FACTOR).quantize(Decimal("0.01"))


def next_hire_anniversary(hire_date: date, after: date) -> date:
    """Próximo aniversario de ingreso estrictamente posterior a `after`."""
    year = hire_date.year + 1
    while True:
        try:
            candidate = hire_date.replace(year=year)
        except ValueError:
            last_day = calendar.monthrange(year, hire_date.month)[1]
            candidate = date(year, hire_date.month, min(hire_date.day, last_day))
        if candidate > after:
            return candidate
        year += 1


def _anniversaries_between(hire_date: date, start: date, end: date) -> list[date]:
    anniversaries: list[date] = []
    cursor = start
    while True:
        nxt = next_hire_anniversary(hire_date, cursor)
        if nxt > end:
            break
        anniversaries.append(nxt)
        cursor = nxt
    return anniversaries


def compute_vacation_end_date(start_date: date, days: Decimal) -> date:
    """Fecha fin inclusive: inicio + ceil(días) - 1 día calendario."""
    calendar_days = max(1, math.ceil(float(days)))
    return start_date + timedelta(days=calendar_days - 1)


def compute_vacation_payment(salary: Decimal, days: Decimal) -> Decimal:
    if salary <= 0 or days <= 0:
        return Decimal("0")
    daily_rate = salary / DAYS_IN_MONTH
    return (days * daily_rate).quantize(Decimal("0.01"))


def compute_vacation_balance(
    employee: "Employee",
    usages: list["VacationUsage"],
    as_of: date | None = None,
) -> Decimal:
    as_of = as_of or date.today()
    if as_of < employee.hire_date:
        return Decimal("0")

    opening_balance = employee.vacation_opening_balance or Decimal("0")
    cursor = get_vacation_accrual_cursor(employee, as_of)
    if cursor < employee.hire_date:
        cursor = employee.hire_date

    balance = Decimal(opening_balance)
    effective_end = as_of
    if employee.termination_date and employee.termination_date < effective_end:
        effective_end = employee.termination_date

    if effective_end < cursor:
        used = sum((u.days or Decimal("0")) for u in usages)
        return (balance - used).quantize(Decimal("0.01"))

    for anniversary in _anniversaries_between(employee.hire_date, cursor, effective_end):
        balance += accrue_days(cursor, anniversary)
        cursor = anniversary

    balance += accrue_days(cursor, effective_end)

    used = sum((u.days or Decimal("0")) for u in usages)
    return (balance - used).quantize(Decimal("0.01"))
