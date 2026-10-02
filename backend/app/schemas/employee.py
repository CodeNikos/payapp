from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from typing import Optional, List
from datetime import date, datetime, time
from decimal import Decimal
import re

from app.models.employee import (
    EmployeeStatus,
    ContractType,
    DocumentType,
    SATURDAY_HALF_DAY_HOURS,
    DEFAULT_SATURDAY_CLOCK_IN,
    DEFAULT_SATURDAY_CLOCK_OUT,
)

_TIME_RE = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")


def _parse_hhmm(value: str) -> time:
    match = _TIME_RE.match(value.strip())
    if not match:
        raise ValueError(f"Hora inválida: {value}. Use HH:MM (24h)")
    return time(int(match.group(1)), int(match.group(2)))


class EmployeeBase(BaseModel):
    first_name: str
    last_name: str
    document_id: str
    document_type: DocumentType = DocumentType.cedula
    social_security_number: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    position: str
    department: str
    base_salary: Decimal
    weekly_contract_hours: Decimal = Field(default=Decimal("40"), gt=0, le=168)
    works_saturday_half_day: bool = False
    saturday_hours: Optional[Decimal] = Field(default=None, ge=Decimal("0.5"), le=Decimal("12"))
    saturday_clock_in: Optional[str] = None
    saturday_clock_out: Optional[str] = None
    is_trusted_staff: bool = False
    hire_date: date
    contract_type: ContractType = ContractType.indefinido
    termination_date: Optional[date] = None
    vacation_opening_balance: Decimal = Field(default=Decimal("0"), ge=0)
    company_code: Optional[str] = None

    @field_validator("saturday_clock_in", "saturday_clock_out", mode="before")
    @classmethod
    def empty_time_to_none(cls, v):
        if v is None or (isinstance(v, str) and not v.strip()):
            return None
        return v.strip() if isinstance(v, str) else v

    @model_validator(mode="after")
    def validate_saturday_schedule(self):
        if self.works_saturday_half_day:
            hours = self.saturday_hours if self.saturday_hours is not None else SATURDAY_HALF_DAY_HOURS
            if hours is None or hours <= 0:
                raise ValueError("Indica las horas del sábado (mayor a 0)")
            self.saturday_hours = hours
            cin = self.saturday_clock_in or DEFAULT_SATURDAY_CLOCK_IN
            cout = self.saturday_clock_out or DEFAULT_SATURDAY_CLOCK_OUT
            t_in = _parse_hhmm(cin)
            t_out = _parse_hhmm(cout)
            if t_out <= t_in:
                raise ValueError("La salida del sábado debe ser posterior a la entrada")
            self.saturday_clock_in = cin
            self.saturday_clock_out = cout
        return self


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    document_id: Optional[str] = None
    document_type: Optional[DocumentType] = None
    social_security_number: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    position: Optional[str] = None
    department: Optional[str] = None
    base_salary: Optional[Decimal] = None
    weekly_contract_hours: Optional[Decimal] = Field(default=None, gt=0, le=168)
    works_saturday_half_day: Optional[bool] = None
    saturday_hours: Optional[Decimal] = Field(default=None, ge=Decimal("0.5"), le=Decimal("12"))
    saturday_clock_in: Optional[str] = None
    saturday_clock_out: Optional[str] = None
    is_trusted_staff: Optional[bool] = None
    hire_date: Optional[date] = None
    contract_type: Optional[ContractType] = None
    status: Optional[EmployeeStatus] = None
    termination_date: Optional[date] = None
    vacation_opening_balance: Optional[Decimal] = Field(default=None, ge=0)
    company_code: Optional[str] = None

    @field_validator("saturday_clock_in", "saturday_clock_out", mode="before")
    @classmethod
    def empty_time_to_none(cls, v):
        if v is None or (isinstance(v, str) and not v.strip()):
            return None
        return v.strip() if isinstance(v, str) else v

    @model_validator(mode="after")
    def validate_saturday_partial(self):
        cin = self.saturday_clock_in
        cout = self.saturday_clock_out
        # Solo validar el par si ambos vienen en el patch, o si uno solo (error)
        if cin is not None or cout is not None:
            # En update parcial puede venir solo uno; se valida contra el otro si ambos presentes
            if cin is not None and cout is not None:
                t_in = _parse_hhmm(cin)
                t_out = _parse_hhmm(cout)
                if t_out <= t_in:
                    raise ValueError("La salida del sábado debe ser posterior a la entrada")
            elif cin is not None and cout is None:
                _parse_hhmm(cin)
            elif cout is not None and cin is None:
                _parse_hhmm(cout)
        return self


class EmployeeResponse(EmployeeBase):
    id: int
    employee_code: str
    status: EmployeeStatus
    is_active: bool
    vacation_opening_balance_date: Optional[date] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class EmployeeImportRowError(BaseModel):
    row: int
    message: str


class EmployeeImportResult(BaseModel):
    created: int
    skipped: int
    errors: List[EmployeeImportRowError]
