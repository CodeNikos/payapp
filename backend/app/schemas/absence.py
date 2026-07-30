from pydantic import BaseModel, Field, model_validator
from typing import Optional
from datetime import date, datetime
from decimal import Decimal

from app.models.absence import AbsenceType, AbsenceDeductionMode, AbsenceStatus


class AbsenceBase(BaseModel):
    employee_id: int
    absence_type: AbsenceType
    start_date: date
    end_date: date
    days: Decimal = Field(..., gt=0)
    deduction_mode: Optional[AbsenceDeductionMode] = None
    comments: Optional[str] = None


class AbsenceCreate(AbsenceBase):
    @model_validator(mode="after")
    def validate_create(self):
        if self.end_date < self.start_date:
            raise ValueError("La fecha fin no puede ser anterior a la fecha inicio")
        if self.absence_type == AbsenceType.injustificada and not self.deduction_mode:
            raise ValueError("Indica el modo de descuento para ausencias injustificadas")
        if self.absence_type != AbsenceType.injustificada and self.deduction_mode:
            raise ValueError("El modo de descuento solo aplica a ausencias injustificadas")
        if self.absence_type == AbsenceType.otros and not (self.comments or "").strip():
            raise ValueError("Los comentarios son obligatorios para el tipo Otros")
        return self


class AbsenceUpdate(BaseModel):
    absence_type: Optional[AbsenceType] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    days: Optional[Decimal] = Field(default=None, gt=0)
    deduction_mode: Optional[AbsenceDeductionMode] = None
    comments: Optional[str] = None


class AbsenceResponse(BaseModel):
    id: int
    employee_id: int
    absence_type: AbsenceType
    start_date: date
    end_date: date
    days: Decimal
    is_justified: bool
    deduction_mode: Optional[AbsenceDeductionMode] = None
    evidence_url: Optional[str] = None
    evidence_public_id: Optional[str] = None
    comments: Optional[str] = None
    vacation_usage_id: Optional[int] = None
    payroll_id: Optional[int] = None
    status: AbsenceStatus
    created_at: datetime
    updated_at: Optional[datetime] = None
    employee_name: Optional[str] = None

    model_config = {"from_attributes": True}
