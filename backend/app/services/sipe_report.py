"""Generación del archivo Excel SIPE (planilla CSS Panamá)."""
from __future__ import annotations

from calendar import monthrange
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from io import BytesIO

from openpyxl import Workbook
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.employee import DocumentType, Employee
from app.models.payroll import Payroll, PayrollStatus, PayrollType
from app.models.settlement import Settlement
from app.models.vacation_usage import VacationUsage

SIPE_HEADERS = [
    "Tipo De Documento",
    "Cedula",
    "Numero de Seguro Social",
    "Nombre",
    "Apellido",
    "Sueldo",
    "HorasExtras",
    "ImpuestoSobreRenta",
    "DecimoTercerMes",
    "Vacaciones",
    "Comisiones",
    "Bonificaciones",
    "Combustible",
    "Dieta",
    "SalarioenEspecie",
    "Viaticos",
    "GastodeRepresentacion",
    "ImpuestoSobreRentaGastoRepresentacion",
    "DecimoTercerMesGastoRepresentacion",
    "PrimasdeProduccion",
    "Dividendo",
    "ParticipacionBeneficioIngresos",
    "GratificacionAguinaldo",
    "Preaviso",
    "Indemnizacion",
]

DOCUMENT_TYPE_LABEL = {
    DocumentType.cedula: "Cédula",
    DocumentType.pasaporte: "Pasaporte",
}


def _d(v) -> Decimal:
    if v is None:
        return Decimal("0")
    return Decimal(str(v))


def _zero_if_missing(v) -> Decimal:
    """Si no hay valor, reporta 0 (regla SIPE para columnas opcionales)."""
    return _d(v)


@dataclass
class SipeRow:
    employee_id: int
    document_type: str
    document_id: str
    social_security_number: str
    first_name: str
    last_name: str
    sueldo: Decimal = field(default_factory=lambda: Decimal("0"))
    horas_extras: Decimal = field(default_factory=lambda: Decimal("0"))
    impuesto_renta: Decimal = field(default_factory=lambda: Decimal("0"))
    decimo: Decimal = field(default_factory=lambda: Decimal("0"))
    vacaciones: Decimal = field(default_factory=lambda: Decimal("0"))
    comisiones: Decimal = field(default_factory=lambda: Decimal("0"))
    bonificaciones: Decimal = field(default_factory=lambda: Decimal("0"))
    combustible: Decimal = field(default_factory=lambda: Decimal("0"))
    dieta: Decimal = field(default_factory=lambda: Decimal("0"))
    salario_especie: Decimal = field(default_factory=lambda: Decimal("0"))
    viaticos: Decimal = field(default_factory=lambda: Decimal("0"))
    gasto_representacion: Decimal = field(default_factory=lambda: Decimal("0"))
    isr_gasto_representacion: Decimal = field(default_factory=lambda: Decimal("0"))
    decimo_gasto_representacion: Decimal = field(default_factory=lambda: Decimal("0"))
    primas_produccion: Decimal = field(default_factory=lambda: Decimal("0"))
    dividendo: Decimal = field(default_factory=lambda: Decimal("0"))
    participacion_beneficios: Decimal = field(default_factory=lambda: Decimal("0"))
    gratificacion: Decimal = field(default_factory=lambda: Decimal("0"))
    preaviso: Decimal = field(default_factory=lambda: Decimal("0"))
    indemnizacion: Decimal = field(default_factory=lambda: Decimal("0"))
    missing_nss: bool = False

    def to_excel_values(self) -> list:
        return [
            self.document_type,
            self.document_id,
            self.social_security_number or "0",
            self.first_name,
            self.last_name,
            float(self.sueldo),
            float(self.horas_extras),
            float(self.impuesto_renta),
            float(self.decimo),
            float(self.vacaciones),
            float(self.comisiones),
            float(self.bonificaciones),
            float(self.combustible),
            float(self.dieta),
            float(self.salario_especie),
            float(self.viaticos),
            float(self.gasto_representacion),
            float(self.isr_gasto_representacion),
            float(self.decimo_gasto_representacion),
            float(self.primas_produccion),
            float(self.dividendo),
            float(self.participacion_beneficios),
            float(self.gratificacion),
            float(self.preaviso),
            float(self.indemnizacion),
        ]


def _month_bounds(year: int, month: int) -> tuple[date, date]:
    last = monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last)


def _empty_row(emp: Employee) -> SipeRow:
    doc_type = getattr(emp, "document_type", None) or DocumentType.cedula
    nss = (emp.social_security_number or "").strip()
    return SipeRow(
        employee_id=emp.id,
        document_type=DOCUMENT_TYPE_LABEL.get(doc_type, "Cédula"),
        document_id=emp.document_id,
        social_security_number=nss,
        first_name=emp.first_name,
        last_name=emp.last_name,
        missing_nss=not bool(nss),
    )


async def build_sipe_rows(db: AsyncSession, year: int, month: int) -> list[SipeRow]:
    start, end = _month_bounds(year, month)
    by_id: dict[int, SipeRow] = {}

    def row_for(emp: Employee) -> SipeRow:
        if emp.id not in by_id:
            by_id[emp.id] = _empty_row(emp)
        return by_id[emp.id]

    payroll_q = (
        select(Payroll)
        .options(selectinload(Payroll.employee))
        .where(
            Payroll.status != PayrollStatus.anulado,
            Payroll.period_end >= start,
            Payroll.period_start <= end,
        )
    )
    for payroll in (await db.execute(payroll_q)).scalars().all():
        emp = payroll.employee
        if not emp:
            continue
        r = row_for(emp)
        if payroll.payroll_type == PayrollType.decimo:
            r.decimo += _d(payroll.gross_salary)
        else:
            r.sueldo += _d(payroll.base_salary)
            r.horas_extras += _d(payroll.overtime_amount)
            r.impuesto_renta += _d(payroll.income_tax)
            r.comisiones += _d(payroll.commissions)
            r.bonificaciones += _d(payroll.bonuses)
            r.combustible += _zero_if_missing(getattr(payroll, "fuel_allowance", None))
            r.dieta += _zero_if_missing(getattr(payroll, "meal_allowance", None))
            r.salario_especie += _zero_if_missing(getattr(payroll, "salary_in_kind", None))
            r.viaticos += _zero_if_missing(getattr(payroll, "travel_allowance", None))
            r.gasto_representacion += _zero_if_missing(
                getattr(payroll, "representation_expense", None)
            )
            # Columnas sin campo en el sistema → 0 vía _zero_if_missing(None)
            r.isr_gasto_representacion += _zero_if_missing(
                getattr(payroll, "representation_income_tax", None)
            )
            r.decimo_gasto_representacion += _zero_if_missing(
                getattr(payroll, "representation_decimo", None)
            )
            r.primas_produccion += _zero_if_missing(getattr(payroll, "production_bonus", None))
            r.dividendo += _zero_if_missing(getattr(payroll, "dividend", None))
            r.participacion_beneficios += _zero_if_missing(
                getattr(payroll, "profit_sharing", None)
            )
            r.gratificacion += _zero_if_missing(getattr(payroll, "gratuity", None))

    vac_q = (
        select(VacationUsage)
        .options(selectinload(VacationUsage.employee))
        .where(VacationUsage.usage_date >= start, VacationUsage.usage_date <= end)
    )
    for usage in (await db.execute(vac_q)).scalars().all():
        emp = usage.employee
        if not emp:
            continue
        row_for(emp).vacaciones += _d(usage.amount)

    set_q = (
        select(Settlement)
        .options(selectinload(Settlement.employee))
        .where(Settlement.termination_date >= start, Settlement.termination_date <= end)
    )
    for settlement in (await db.execute(set_q)).scalars().all():
        emp = settlement.employee
        if not emp:
            continue
        r = row_for(emp)
        r.vacaciones += _d(settlement.vacation_amount)
        r.decimo += _d(settlement.decimo_amount)
        r.preaviso += _d(settlement.employer_notice_amount)
        r.indemnizacion += _d(settlement.indemnity_amount)

    rows = sorted(by_id.values(), key=lambda x: (x.last_name.lower(), x.first_name.lower()))
    for r in rows:
        for attr in (
            "sueldo", "horas_extras", "impuesto_renta", "decimo", "vacaciones",
            "comisiones", "bonificaciones", "combustible", "dieta", "salario_especie",
            "viaticos", "gasto_representacion", "isr_gasto_representacion",
            "decimo_gasto_representacion", "primas_produccion", "dividendo",
            "participacion_beneficios", "gratificacion", "preaviso", "indemnizacion",
        ):
            setattr(r, attr, _d(getattr(r, attr)).quantize(Decimal("0.01")))
    return rows


def rows_to_workbook_bytes(rows: list[SipeRow]) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "SIPE"
    ws.append(SIPE_HEADERS)
    for row in rows:
        ws.append(row.to_excel_values())
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def sipe_filename(year: int, month: int) -> str:
    return f"sipe_planilla_{year}_{month:02d}.xlsx"
