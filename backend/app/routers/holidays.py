from datetime import date
from typing import List, Optional
import csv
import io
import re
import unicodedata

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.holiday import Holiday
from app.models.user import User
from app.schemas.holiday import (
    HolidayCreate,
    HolidayUpdate,
    HolidayResponse,
    HolidayImportResult,
    HolidayImportRowError,
)

router = APIRouter()

MAX_CSV_BYTES = 512_000
MAX_CSV_ROWS = 366

DATE_ALIASES = {"fecha", "holiday_date", "date", "fecha_feriado"}
NAME_ALIASES = {"nombre", "name", "nombre_feriado"}
DESC_ALIASES = {"descripcion", "description", "notas", "notes"}


def _year_from_date(d: date) -> int:
    return d.year


def _normalize_header(value: str) -> str:
    """Normaliza encabezados: minúsculas, sin tildes y espacios → guiones bajos."""
    value = value.strip().lower()
    value = unicodedata.normalize("NFD", value)
    value = "".join(c for c in value if unicodedata.category(c) != "Mn")
    return re.sub(r"[\s\-]+", "_", value)


def _decode_csv_bytes(raw_bytes: bytes) -> str:
    """Decodifica CSV en español: UTF-8 (Excel/BOM), UTF-16 o Windows-1252."""
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


def _parse_holiday_date(raw: str) -> date:
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


def _pick_column(row: dict, aliases: set[str]) -> Optional[str]:
    for key, value in row.items():
        if _normalize_header(key) in aliases:
            return value
    return None


def _parse_csv_rows(content: str) -> tuple[list[dict], list[HolidayImportRowError]]:
    reader = csv.DictReader(io.StringIO(content))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="El archivo CSV no tiene encabezados")

    normalized_fields = {_normalize_header(f) for f in reader.fieldnames}
    if not normalized_fields & DATE_ALIASES:
        raise HTTPException(
            status_code=400,
            detail="Falta la columna de fecha. Use: fecha, holiday_date o date",
        )
    if not normalized_fields & NAME_ALIASES:
        raise HTTPException(
            status_code=400,
            detail="Falta la columna de nombre. Use: nombre, name o nombre_feriado",
        )

    rows: list[dict] = []
    errors: list[HolidayImportRowError] = []
    seen_dates: set[date] = set()

    for index, raw_row in enumerate(reader, start=2):
        if index - 2 >= MAX_CSV_ROWS:
            errors.append(HolidayImportRowError(row=index, message="Límite de filas excedido en el archivo"))
            break

        if not any((v or "").strip() for v in raw_row.values()):
            continue

        date_raw = (_pick_column(raw_row, DATE_ALIASES) or "").strip()
        name_raw = (_pick_column(raw_row, NAME_ALIASES) or "").strip()
        desc_raw = (_pick_column(raw_row, DESC_ALIASES) or "").strip()

        try:
            if not date_raw:
                raise ValueError("Fecha obligatoria")
            if not name_raw:
                raise ValueError("Nombre obligatorio")
            if len(name_raw) < 2:
                raise ValueError("El nombre debe tener al menos 2 caracteres")

            holiday_date = _parse_holiday_date(date_raw)
            if holiday_date in seen_dates:
                raise ValueError(f"Fecha duplicada en el archivo: {holiday_date.isoformat()}")

            seen_dates.add(holiday_date)
            rows.append({
                "holiday_date": holiday_date,
                "name": name_raw[:200],
                "description": desc_raw[:500] or None,
                "year": _year_from_date(holiday_date),
            })
        except ValueError as exc:
            errors.append(HolidayImportRowError(row=index, message=str(exc)))

    return rows, errors


async def _ensure_unique_date(
    db: AsyncSession,
    holiday_date: date,
    exclude_id: Optional[int] = None,
):
    query = select(Holiday).where(Holiday.holiday_date == holiday_date)
    if exclude_id is not None:
        query = query.where(Holiday.id != exclude_id)
    result = await db.execute(query)
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ya existe un feriado registrado para esa fecha")


@router.get("/", response_model=List[HolidayResponse])
async def list_holidays(
    year: Optional[int] = Query(None, ge=2000, le=2100),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=366),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Holiday).order_by(Holiday.holiday_date)
    if year is not None:
        query = query.where(Holiday.year == year)

    result = await db.execute(query.offset(skip).limit(limit))
    return [HolidayResponse.model_validate(h) for h in result.scalars().all()]


@router.get("/years", response_model=List[int])
async def list_holiday_years(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Holiday.year).distinct().order_by(Holiday.year.desc())
    )
    return [row[0] for row in result.all()]


@router.post("/", response_model=HolidayResponse, status_code=201)
async def create_holiday(
    data: HolidayCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    await _ensure_unique_date(db, data.holiday_date)

    holiday = Holiday(
        **data.model_dump(),
        year=_year_from_date(data.holiday_date),
    )
    db.add(holiday)
    await db.commit()
    await db.refresh(holiday)
    return HolidayResponse.model_validate(holiday)


@router.post("/import-csv", response_model=HolidayImportResult)
async def import_holidays_csv(
    file: UploadFile = File(...),
    skip_duplicates: bool = Query(True, description="Omitir fechas ya registradas"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="El archivo debe ser .csv")

    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="El archivo está vacío")
    if len(raw_bytes) > MAX_CSV_BYTES:
        raise HTTPException(status_code=400, detail="El archivo supera el tamaño máximo permitido (512 KB)")

    content = _decode_csv_bytes(raw_bytes)
    parsed_rows, row_errors = _parse_csv_rows(content)

    if not parsed_rows and row_errors:
        return HolidayImportResult(created=0, skipped=0, errors=row_errors)

    existing_dates: set[date] = set()
    if parsed_rows:
        dates = [row["holiday_date"] for row in parsed_rows]
        result = await db.execute(select(Holiday.holiday_date).where(Holiday.holiday_date.in_(dates)))
        existing_dates = {row[0] for row in result.all()}

    created = 0
    skipped = 0

    for row in parsed_rows:
        if row["holiday_date"] in existing_dates:
            if skip_duplicates:
                skipped += 1
                continue
            row_errors.append(HolidayImportRowError(
                row=0,
                message=f"Ya existe un feriado para {row['holiday_date'].isoformat()}",
            ))
            continue

        db.add(Holiday(**row))
        existing_dates.add(row["holiday_date"])
        created += 1

    if created:
        await db.commit()

    return HolidayImportResult(created=created, skipped=skipped, errors=row_errors)


@router.get("/{holiday_id}", response_model=HolidayResponse)
async def get_holiday(
    holiday_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Holiday).where(Holiday.id == holiday_id))
    holiday = result.scalar_one_or_none()
    if not holiday:
        raise HTTPException(status_code=404, detail="Feriado no encontrado")
    return HolidayResponse.model_validate(holiday)


@router.patch("/{holiday_id}", response_model=HolidayResponse)
async def update_holiday(
    holiday_id: int,
    data: HolidayUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(Holiday).where(Holiday.id == holiday_id))
    holiday = result.scalar_one_or_none()
    if not holiday:
        raise HTTPException(status_code=404, detail="Feriado no encontrado")

    updates = data.model_dump(exclude_unset=True)
    if "holiday_date" in updates:
        await _ensure_unique_date(db, updates["holiday_date"], exclude_id=holiday_id)
        updates["year"] = _year_from_date(updates["holiday_date"])

    for key, value in updates.items():
        setattr(holiday, key, value)

    await db.commit()
    await db.refresh(holiday)
    return HolidayResponse.model_validate(holiday)


@router.delete("/{holiday_id}", status_code=204)
async def delete_holiday(
    holiday_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(Holiday).where(Holiday.id == holiday_id))
    holiday = result.scalar_one_or_none()
    if not holiday:
        raise HTTPException(status_code=404, detail="Feriado no encontrado")

    await db.delete(holiday)
    await db.commit()
