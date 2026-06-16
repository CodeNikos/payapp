from pydantic import BaseModel, model_validator
from typing import Optional
from datetime import date, datetime
from decimal import Decimal
from app.models.payroll import PayrollStatus


class PayrollCreate(BaseModel):
    employee_id: int
    period_start: date
    period_end: date
    overtime_hours: Decimal = Decimal("0")
    bonuses: Decimal = Decimal("0")
    other_deductions: Decimal = Decimal("0")
    notes: Optional[str] = None

    @model_validator(mode="after")
    def validate_period(self):
        if self.period_end < self.period_start:
            raise ValueError("La fecha de fin debe ser posterior o igual al inicio del período")
        return self


class PayrollReject(BaseModel):
    reason: Optional[str] = None


class PayrollResponse(BaseModel):
    id: int
    employee_id: int
    period_start: date
    period_end: date
    base_salary: Decimal
    overtime_hours: Decimal
    overtime_amount: Decimal
    bonuses: Decimal
    gross_salary: Decimal
    social_security: Decimal
    educational_insurance: Decimal
    income_tax: Decimal
    other_deductions: Decimal
    total_deductions: Decimal
    net_salary: Decimal
    status: PayrollStatus
    payment_date: Optional[date]
    notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}
