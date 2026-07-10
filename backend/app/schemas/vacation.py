from pydantic import BaseModel, Field, model_validator
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal


class VacationReportItem(BaseModel):
    employee_id: int
    employee_name: str
    document_id: str
    hire_date: date
    base_salary: Decimal
    accumulated_days: Decimal
    vacation_opening_balance: Decimal
    vacation_opening_balance_date: Optional[date] = None


class VacationReportResponse(BaseModel):
    as_of: date
    items: List[VacationReportItem]


class VacationTakenReportItem(BaseModel):
    id: int
    employee_id: int
    employee_name: str
    document_id: str
    start_date: date
    end_date: date
    days: Decimal
    amount: Decimal
    notes: Optional[str] = None


class VacationTakenReportResponse(BaseModel):
    items: List[VacationTakenReportItem]


class VacationUsageCreate(BaseModel):
    employee_id: int
    start_date: date
    end_date: Optional[date] = None
    days: Optional[Decimal] = Field(default=None, gt=0, le=365)
    notes: Optional[str] = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.end_date is not None and self.end_date < self.start_date:
            raise ValueError("La fecha de fin debe ser posterior o igual a la fecha de inicio")
        if self.days is None and self.end_date is None:
            raise ValueError("Indica los días de vacaciones o un rango de fechas")
        return self


class VacationUsageResponse(BaseModel):
    id: int
    employee_id: int
    start_date: date
    end_date: date
    usage_date: date
    days: Decimal
    amount: Decimal
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class VacationDetailResponse(BaseModel):
    employee_id: int
    employee_name: str
    document_id: str
    hire_date: date
    base_salary: Decimal
    accumulated_days: Decimal
    vacation_opening_balance: Decimal
    vacation_opening_balance_date: Optional[date] = None
    usages: List[VacationUsageResponse]
    as_of: date
