from pydantic import BaseModel, Field, model_validator
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal

from app.models.recurring_deduction import DeductionFrequency


class RecurringDeductionBase(BaseModel):
    employee_id: int
    concept: str = Field(..., min_length=1, max_length=200)
    amount: Decimal = Field(..., gt=0)
    frequency: DeductionFrequency
    monthly_quincena: Optional[int] = Field(default=None, ge=1, le=2)
    start_date: date
    end_date: Optional[date] = None
    is_active: bool = True

    @model_validator(mode="after")
    def validate_rules(self):
        if self.frequency == DeductionFrequency.mensual and self.monthly_quincena is None:
            raise ValueError("monthly_quincena es requerido cuando la frecuencia es mensual")
        if self.frequency == DeductionFrequency.quincenal:
            self.monthly_quincena = None
        if self.end_date is not None and self.end_date < self.start_date:
            raise ValueError("end_date debe ser posterior o igual a start_date")
        return self


class RecurringDeductionCreate(RecurringDeductionBase):
    pass


class RecurringDeductionUpdate(BaseModel):
    concept: Optional[str] = Field(default=None, min_length=1, max_length=200)
    amount: Optional[Decimal] = Field(default=None, gt=0)
    frequency: Optional[DeductionFrequency] = None
    monthly_quincena: Optional[int] = Field(default=None, ge=1, le=2)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None

    @model_validator(mode="after")
    def validate_end(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date debe ser posterior o igual a start_date")
        return self


class RecurringDeductionResponse(BaseModel):
    id: int
    employee_id: int
    employee_name: Optional[str] = None
    document_id: Optional[str] = None
    concept: str
    amount: Decimal
    frequency: DeductionFrequency
    monthly_quincena: Optional[int] = None
    start_date: date
    end_date: Optional[date] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class RecurringDeductionListResponse(BaseModel):
    items: List[RecurringDeductionResponse]
