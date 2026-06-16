"""
Cálculo de horas y recargos según Código de Trabajo de Panamá (Art. 30 y 33).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, time, timedelta
from decimal import Decimal
from typing import Iterable, Optional

from app.models.employee import Employee
from app.models.timesheet import TimesheetEntry

# Jornadas (Art. 30)
DIURNAL_START = 6 * 60          # 06:00
DIURNAL_END = 18 * 60           # 18:00
MAX_OVERTIME_DAY = Decimal("3")
MAX_OVERTIME_WEEK = Decimal("9")
EXCESS_SURCHARGE = Decimal("0.75")

# Recargos horas extra (Art. 33)
MULT_DIURNAL = Decimal("1.25")
MULT_NOCTURNAL = Decimal("1.50")


@dataclass
class OvertimeBreakdown:
    total_hours: Decimal = Decimal("0")
    total_amount: Decimal = Decimal("0")
    warnings: list[str] = field(default_factory=list)


def _time_to_minutes(t: time) -> int:
    return t.hour * 60 + t.minute


def _minutes_to_hours(minutes: int) -> Decimal:
    return (Decimal(minutes) / Decimal("60")).quantize(Decimal("0.01"))


def _split_diurnal_nocturnal(start: time, end: time) -> list[tuple[int, str]]:
    """Divide un intervalo en segmentos diurnos y nocturnos (minutos, tipo)."""
    if end <= start:
        return []

    start_m = _time_to_minutes(start)
    end_m = _time_to_minutes(end)
    segments: list[tuple[int, str]] = []
    cursor = start_m

    while cursor < end_m:
        if DIURNAL_START <= cursor < DIURNAL_END:
            next_boundary = min(end_m, DIURNAL_END)
            segments.append((next_boundary - cursor, "diurnal"))
            cursor = next_boundary
        else:
            if cursor >= DIURNAL_END:
                next_boundary = min(end_m, 24 * 60)
            else:
                next_boundary = min(end_m, DIURNAL_START)
            segments.append((next_boundary - cursor, "nocturnal"))
            cursor = next_boundary

    return segments


def _overtime_minutes(entry: TimesheetEntry) -> int:
    if not entry.overtime_start or not entry.overtime_end:
        return 0
    if entry.overtime_end <= entry.overtime_start:
        return 0
    return _time_to_minutes(entry.overtime_end) - _time_to_minutes(entry.overtime_start)


def _segment_multiplier(kind: str, apply_excess: bool) -> Decimal:
    base = MULT_DIURNAL if kind == "diurnal" else MULT_NOCTURNAL
    if apply_excess:
        return base + EXCESS_SURCHARGE
    return base


def calculate_overtime_from_timesheets(
    hourly_rate: Decimal,
    entries: Iterable[TimesheetEntry],
) -> OvertimeBreakdown:
    """Calcula monto de horas extra desde marcaciones con recargos legales."""
    result = OvertimeBreakdown()
    daily_ot: dict[date, Decimal] = {}
    weekly_ot: dict[tuple[int, int], Decimal] = {}

    sorted_entries = sorted(entries, key=lambda e: e.work_date)

    for entry in sorted_entries:
        if not entry.overtime_start or not entry.overtime_end:
            continue
        if entry.overtime_end <= entry.overtime_start:
            result.warnings.append(
                f"{entry.work_date.isoformat()}: hora extra fin debe ser posterior al inicio"
            )
            continue

        day_total_minutes = _overtime_minutes(entry)
        day_hours = _minutes_to_hours(day_total_minutes)
        if day_hours <= 0:
            continue

        iso = entry.work_date.isocalendar()
        week_key = (iso.year, iso.week)
        daily_ot[entry.work_date] = daily_ot.get(entry.work_date, Decimal("0")) + day_hours
        weekly_ot[week_key] = weekly_ot.get(week_key, Decimal("0")) + day_hours

        if daily_ot[entry.work_date] > MAX_OVERTIME_DAY:
            result.warnings.append(
                f"{entry.work_date.isoformat()}: excede {MAX_OVERTIME_DAY} h extra diarias (recargo +75%)"
            )
        if weekly_ot[week_key] > MAX_OVERTIME_WEEK:
            result.warnings.append(
                f"Semana {iso.week}/{iso.year}: excede {MAX_OVERTIME_WEEK} h extra semanales (recargo +75%)"
            )

        segments = _split_diurnal_nocturnal(entry.overtime_start, entry.overtime_end)
        day_so_far = daily_ot[entry.work_date] - day_hours
        week_so_far = weekly_ot[week_key] - day_hours

        for minutes, kind in segments:
            seg_hours = _minutes_to_hours(minutes)
            result.total_hours += seg_hours

            remaining_day = MAX_OVERTIME_DAY - day_so_far
            remaining_week = MAX_OVERTIME_WEEK - week_so_far
            normal_hours = min(seg_hours, max(Decimal("0"), remaining_day), max(Decimal("0"), remaining_week))
            excess_hours = seg_hours - normal_hours

            if normal_hours > 0:
                mult = _segment_multiplier(kind, apply_excess=False)
                result.total_amount += (hourly_rate * normal_hours * mult).quantize(Decimal("0.01"))
                day_so_far += normal_hours
                week_so_far += normal_hours

            if excess_hours > 0:
                mult = _segment_multiplier(kind, apply_excess=True)
                result.total_amount += (hourly_rate * excess_hours * mult).quantize(Decimal("0.01"))
                day_so_far += excess_hours
                week_so_far += excess_hours

    result.total_amount = result.total_amount.quantize(Decimal("0.01"))
    result.total_hours = result.total_hours.quantize(Decimal("0.01"))
    return result


def calculate_manual_overtime(hourly_rate: Decimal, hours: Decimal) -> tuple[Decimal, Decimal]:
    """Personal de confianza: horas extra manuales con recargo diurno (25%)."""
    hours = max(Decimal("0"), hours)
    amount = (hourly_rate * hours * MULT_DIURNAL).quantize(Decimal("0.01"))
    return hours, amount


def is_working_day(employee: Employee, d: date, holidays: set[date]) -> bool:
    if d in holidays:
        return False
    wd = d.weekday()
    if wd == 6:
        return False
    if wd == 5 and not employee.works_saturday_half_day:
        return False
    return True


def iter_period_dates(start: date, end: date) -> Iterable[date]:
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)


def validate_timesheet_completeness(
    employee: Employee,
    entries_by_date: dict[date, TimesheetEntry],
    holidays: set[date],
    period_start: date,
    period_end: date,
) -> list[str]:
    """Devuelve lista de fechas laborables sin marcación completa."""
    missing: list[str] = []
    for d in iter_period_dates(period_start, period_end):
        if not is_working_day(employee, d, holidays):
            continue
        entry = entries_by_date.get(d)
        if not entry or not entry.clock_in or not entry.clock_out:
            missing.append(d.isoformat())
    return missing
