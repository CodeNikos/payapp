"""Importación masiva de empleados desde CSV."""
from __future__ import annotations

import csv
import io
import re
import unicodedata
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Optional

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company, CompanyStatus
from app.models.employee import (
    Employee,
    DocumentType,
    ContractType,
    SATURDAY_HALF_DAY_HOURS,
    DEFAULT_SATURDAY_CLOCK_IN,
    DEFAULT_SATURDAY_CLOCK_OUT,
)
from app.schemas.employee import (
    EmployeeCreate,
    EmployeeImportResult,
    EmployeeImportRowError,
)
from app.services.vacation import compute_vacation_balance_cutoff

MAX_CSV_BYTES = 2_000_000
MAX_CSV_ROWS = 2000

TEMPLATE_HEADERS = [
    "first_name",
    "last_name",
    "document_id",
    "document_type",
    "position",
    "department",
    "base_salary",
    "hire_date",
    "company_code",
    "weekly_contract_hours",
    "works_saturday_half_day",
    "saturday_hours",
    "saturday_clock_in",
    "saturday_clock_out",
    "email",
    "phone",
    "social_security_number",
    "contract_type",
    "is_trusted_staff",
]

TEMPLATE_SAMPLE_ROWS = [
    {
        "first_name": "Ana",
        "last_name": "Pérez",
        "document_id": "8-888-888",
        "document_type": "cedula",
        "position": "Asistente",
        "department": "Administración",
        "base_salary": "800.00",
        "hire_date": "2024-01-15",
        "company_code": "",
        "weekly_contract_hours": "40",
        "works_saturday_half_day": "false",
        "saturday_hours": "4",
        "saturday_clock_in": "08:00",
        "saturday_clock_out": "12:00",
        "email": "ana.perez@ejemplo.com",
        "phone": "6000-0000",
        "social_security_number": "",
        "contract_type": "indefinido",
        "is_trusted_staff": "false",
    },
    {
        "first_name": "Luis",
        "last_name": "Gómez",
        "document_id": "9-999-999",
        "document_type": "cedula",
        "position": "Operario",
        "department": "Operaciones",
        "base_salary": "750.00",
        "hire_date": "2023-06-01",
        "company_code": "",
        "weekly_contract_hours": "40",
        "works_saturday_half_day": "true",
        "saturday_hours": "4",
        "saturday_clock_in": "08:00",
        "saturday_clock_out": "12:00",
        "email": "",
        "phone": "",
        "social_security_number": "",
        "contract_type": "indefinido",
        "is_trusted_staff": "false",
    },
]


def generate_employee_code(db_count: int) -> str:
    return f"EMP-{str(db_count + 1).zfill(5)}"


def build_import_template_csv() -> str:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=TEMPLATE_HEADERS, lineterminator="\n")
    writer.writeheader()
    for row in TEMPLATE_SAMPLE_ROWS:
        writer.writerow(row)
    return buf.getvalue()


def _normalize_header(value: str) -> str:
    value = value.strip().lower()
    value = unicodedata.normalize("NFD", value)
    value = "".join(c for c in value if unicodedata.category(c) != "Mn")
    return re.sub(r"[\s\-]+", "_", value)


def decode_csv_bytes(raw_bytes: bytes) -> str:
    if raw_bytes.startswith(b"\xff\xfe") or raw_bytes.startswith(b"\xfe\xff"):
        for encoding in ("utf-16", "utf-16-le", "utf-16-be"):
            try:
                return raw_bytes.decode(encoding)
            except UnicodeDecodeError:
                continue

    for encoding in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            return raw_bytes.decode(encoding)
        except UnicodeDecodeError:
            continue

    raise HTTPException(
        status_code=400,
        detail=(
            "No se pudo leer el archivo. Guárdelo en UTF-8 "
            "(recomendado) o en la codificación de Excel en español."
        ),
    )


def _parse_bool(raw: Optional[str], default: bool = False) -> bool:
    if raw is None or not str(raw).strip():
        return default
    v = str(raw).strip().lower()
    if v in {"1", "true", "t", "yes", "y", "si", "sí", "s"}:
        return True
    if v in {"0", "false", "f", "no", "n"}:
        return False
    raise ValueError(f"Valor booleano inválido: {raw}")


def _parse_date(raw: str) -> date:
    value = raw.strip()
    if not value:
        raise ValueError("Fecha vacía")

    iso_match = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})$", value)
    if iso_match:
        return date(int(iso_match.group(1)), int(iso_match.group(2)), int(iso_match.group(3)))

    dmy_match = re.match(r"^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$", value)
    if dmy_match:
        return date(int(dmy_match.group(3)), int(dmy_match.group(2)), int(dmy_match.group(1)))

    raise ValueError(f"Formato de fecha no válido: {value}. Use YYYY-MM-DD o DD/MM/YYYY")


def _parse_decimal(raw: Optional[str], field: str, required: bool = True) -> Optional[Decimal]:
    if raw is None or not str(raw).strip():
        if required:
            raise ValueError(f"{field} es obligatorio")
        return None
    try:
        return Decimal(str(raw).strip().replace(",", ""))
    except (InvalidOperation, ValueError) as exc:
        raise ValueError(f"{field} inválido: {raw}") from exc


def _cell(row: dict, *aliases: str) -> Optional[str]:
    normalized = {_normalize_header(k): v for k, v in row.items() if k is not None}
    for alias in aliases:
        if alias in normalized and normalized[alias] is not None:
            return str(normalized[alias]).strip()
    return None


def _row_to_create_payload(raw_row: dict) -> dict:
    first_name = _cell(raw_row, "first_name", "nombre", "nombres")
    last_name = _cell(raw_row, "last_name", "apellido", "apellidos")
    document_id = _cell(raw_row, "document_id", "cedula", "documento", "id")
    position = _cell(raw_row, "position", "cargo", "puesto")
    department = _cell(raw_row, "department", "departamento", "area")
    hire_raw = _cell(raw_row, "hire_date", "fecha_ingreso", "fecha_contratacion")

    if not first_name:
        raise ValueError("first_name / nombre es obligatorio")
    if not last_name:
        raise ValueError("last_name / apellido es obligatorio")
    if not document_id:
        raise ValueError("document_id / cedula es obligatorio")
    if not position:
        raise ValueError("position / cargo es obligatorio")
    if not department:
        raise ValueError("department / departamento es obligatorio")
    if not hire_raw:
        raise ValueError("hire_date / fecha_ingreso es obligatorio")

    doc_type_raw = (_cell(raw_row, "document_type", "tipo_documento") or "cedula").lower()
    try:
        document_type = DocumentType(doc_type_raw)
    except ValueError as exc:
        raise ValueError("document_type debe ser cedula o pasaporte") from exc

    contract_raw = (_cell(raw_row, "contract_type", "tipo_contrato") or "indefinido").lower()
    try:
        contract_type = ContractType(contract_raw)
    except ValueError as exc:
        raise ValueError("contract_type inválido (indefinido, temporal, obra_labor)") from exc

    works_sat = _parse_bool(_cell(raw_row, "works_saturday_half_day", "sabado_medio_dia"), False)
    sat_hours = _parse_decimal(
        _cell(raw_row, "saturday_hours", "horas_sabado"),
        "saturday_hours",
        required=False,
    )
    if works_sat and sat_hours is None:
        sat_hours = SATURDAY_HALF_DAY_HOURS

    weekly = _parse_decimal(
        _cell(raw_row, "weekly_contract_hours", "horas_semanales"),
        "weekly_contract_hours",
        required=False,
    )
    if weekly is None:
        weekly = Decimal("40")

    email = _cell(raw_row, "email", "correo") or None
    if email == "":
        email = None

    return {
        "first_name": first_name,
        "last_name": last_name,
        "document_id": document_id,
        "document_type": document_type,
        "social_security_number": _cell(raw_row, "social_security_number", "nss", "seguro_social") or None,
        "email": email,
        "phone": _cell(raw_row, "phone", "telefono", "celular") or None,
        "position": position,
        "department": department,
        "base_salary": _parse_decimal(_cell(raw_row, "base_salary", "salario", "salario_base"), "base_salary"),
        "weekly_contract_hours": weekly,
        "works_saturday_half_day": works_sat,
        "saturday_hours": sat_hours if works_sat else None,
        "saturday_clock_in": (
            _cell(raw_row, "saturday_clock_in", "entrada_sabado") or DEFAULT_SATURDAY_CLOCK_IN
        ) if works_sat else None,
        "saturday_clock_out": (
            _cell(raw_row, "saturday_clock_out", "salida_sabado") or DEFAULT_SATURDAY_CLOCK_OUT
        ) if works_sat else None,
        "is_trusted_staff": _parse_bool(_cell(raw_row, "is_trusted_staff", "personal_confianza"), False),
        "hire_date": _parse_date(hire_raw),
        "contract_type": contract_type,
        "company_code": _cell(raw_row, "company_code", "empresa", "codigo_empresa") or None,
    }


def _format_validation_error(exc: ValidationError) -> str:
    parts = []
    labels = {
        "email": "correo",
        "base_salary": "salario",
        "hire_date": "fecha_ingreso",
        "first_name": "nombre",
        "last_name": "apellido",
        "document_id": "documento",
        "position": "cargo",
        "department": "departamento",
        "saturday_hours": "horas_sabado",
        "saturday_clock_in": "entrada_sabado",
        "saturday_clock_out": "salida_sabado",
        "weekly_contract_hours": "horas_semanales",
        "company_code": "empresa",
    }
    for err in exc.errors():
        loc = [str(x) for x in err.get("loc", []) if x != "body"]
        field = loc[-1] if loc else "dato"
        msg = str(err.get("msg") or "").replace("Value error, ", "")
        label = labels.get(field, field)
        parts.append(f"{label}: {msg}")
    return "; ".join(parts) if parts else "Datos inválidos"


async def import_employees_csv(
    db: AsyncSession,
    raw_bytes: bytes,
    *,
    skip_duplicates: bool = True,
) -> EmployeeImportResult:
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="El archivo está vacío")
    if len(raw_bytes) > MAX_CSV_BYTES:
        raise HTTPException(status_code=400, detail="El archivo supera el tamaño máximo permitido (2 MB)")

    content = decode_csv_bytes(raw_bytes)
    reader = csv.DictReader(io.StringIO(content))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="El archivo CSV no tiene encabezados")

    errors: list[EmployeeImportRowError] = []
    created = 0
    skipped = 0

    # Prefetch existing docs/emails and company codes
    existing_docs = {
        row[0]
        for row in (await db.execute(select(Employee.document_id))).all()
        if row[0]
    }
    existing_emails = {
        row[0].lower()
        for row in (await db.execute(select(Employee.email))).all()
        if row[0]
    }
    companies = {
        row[0]: row[1]
        for row in (
            await db.execute(select(Company.company_code, Company.status))
        ).all()
    }

    count_result = await db.execute(select(func.count(Employee.id)))
    next_count = count_result.scalar() or 0
    seen_docs_in_file: set[str] = set()
    seen_emails_in_file: set[str] = set()

    for index, raw_row in enumerate(reader, start=2):
        if index - 2 >= MAX_CSV_ROWS:
            errors.append(EmployeeImportRowError(row=index, message="Límite de filas excedido en el archivo"))
            break

        if not any((v or "").strip() for v in raw_row.values()):
            continue

        try:
            payload = _row_to_create_payload(raw_row)
            data = EmployeeCreate(**payload)
        except ValueError as exc:
            errors.append(EmployeeImportRowError(row=index, message=str(exc)))
            continue
        except ValidationError as exc:
            errors.append(EmployeeImportRowError(row=index, message=_format_validation_error(exc)))
            continue

        doc = data.document_id
        if doc in seen_docs_in_file or doc in existing_docs:
            if skip_duplicates:
                skipped += 1
                continue
            errors.append(EmployeeImportRowError(
                row=index,
                message=f"Documento ya registrado: {doc}",
            ))
            continue

        email = (data.email or "").lower() if data.email else None
        if email and (email in seen_emails_in_file or email in existing_emails):
            if skip_duplicates:
                skipped += 1
                continue
            errors.append(EmployeeImportRowError(
                row=index,
                message=f"Correo ya registrado: {data.email}",
            ))
            continue

        company_code = data.company_code
        if company_code:
            status = companies.get(company_code)
            if status is None:
                errors.append(EmployeeImportRowError(
                    row=index,
                    message=f"Empresa no encontrada: {company_code}. Usa un company_code válido o déjalo vacío.",
                ))
                continue
            if status == CompanyStatus.cancelado:
                errors.append(EmployeeImportRowError(
                    row=index,
                    message=f"Empresa cancelada: {company_code}",
                ))
                continue

        employee = Employee(
            **data.model_dump(),
            employee_code=generate_employee_code(next_count),
        )
        employee.vacation_opening_balance_date = compute_vacation_balance_cutoff(employee.hire_date)
        db.add(employee)

        next_count += 1
        created += 1
        seen_docs_in_file.add(doc)
        existing_docs.add(doc)
        if email:
            seen_emails_in_file.add(email)
            existing_emails.add(email)

    if created:
        try:
            await db.commit()
        except Exception as exc:
            await db.rollback()
            raise HTTPException(
                status_code=400,
                detail=(
                    "No se pudo guardar la importación (posible documento/correo duplicado "
                    f"u otro conflicto en la base de datos): {exc}"
                ),
            ) from exc

    return EmployeeImportResult(created=created, skipped=skipped, errors=errors)
