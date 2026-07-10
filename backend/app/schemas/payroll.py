from pydantic import BaseModel, model_validator, Field
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal
from app.models.payroll import PayrollStatus, PayrollType


class PayrollCreate(BaseModel):
    employee_id: int
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    payroll_type: PayrollType = PayrollType.regular
    overtime_hours: Decimal = Decimal("0")
    bonuses: Decimal = Decimal("0")
    commissions: Decimal = Decimal("0")
    other_deductions: Decimal = Decimal("0")
    notes: Optional[str] = None
    cuatrimestre: Optional[int] = Field(default=None, ge=1, le=3)
    cuatrimestre_year: Optional[int] = Field(default=None, ge=2000, le=2100)
    payment_date: Optional[date] = None

    @model_validator(mode="after")
    def validate_period(self):
        if self.payroll_type == PayrollType.regular:
            if self.period_start is None or self.period_end is None:
                raise ValueError("period_start y period_end son requeridos para nómina regular")
            if self.period_end < self.period_start:
                raise ValueError("La fecha de fin debe ser posterior o igual al inicio del período")
        if self.payroll_type == PayrollType.decimo:
            if self.cuatrimestre is None or self.cuatrimestre_year is None:
                raise ValueError("cuatrimestre y cuatrimestre_year son requeridos para nómina de décimo")
        return self


class PayrollReject(BaseModel):
    reason: Optional[str] = None


class PayrollResponse(BaseModel):
    id: int
    employee_id: int
    period_start: date
    period_end: date
    payroll_type: PayrollType
    base_salary: Decimal
    overtime_hours: Decimal
    overtime_amount: Decimal
    bonuses: Decimal
    commissions: Decimal
    gross_salary: Decimal
    decimo_accrued_total: Optional[Decimal] = None
    cuatrimestre: Optional[int] = None
    cuatrimestre_year: Optional[int] = None
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


class DecimoPreviewRequest(BaseModel):
    year: int = Field(ge=2000, le=2100)
    cuatrimestre: int = Field(ge=1, le=3)
    employee_ids: Optional[List[int]] = None


class DecimoPreviewItem(BaseModel):
    employee_id: int
    employee_name: str
    accrual_start: date
    accrual_end: date
    base_from_payrolls: Decimal
    overtime_from_payrolls: Decimal
    bonuses_from_payrolls: Decimal
    commissions_from_payrolls: Decimal
    projected_base: Decimal
    accrued_total: Decimal
    decimo_amount: Decimal
    is_proportional: bool
    notes: str
    suggested_payment_date: date


class DecimoPreviewResponse(BaseModel):
    year: int
    cuatrimestre: int
    suggested_payment_date: date
    items: List[DecimoPreviewItem]
