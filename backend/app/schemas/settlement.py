from pydantic import BaseModel, Field, model_validator
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal

from app.models.settlement import SettlementReason


class SettlementCalculateRequest(BaseModel):
    termination_date: date
    reason: SettlementReason
    employer_gave_notice: Optional[bool] = None
    employee_gave_notice: Optional[bool] = None
    notes: Optional[str] = None

    @model_validator(mode="after")
    def validate_notice_flags(self):
        if self.reason == SettlementReason.renuncia_voluntaria and self.employer_gave_notice is not None:
            raise ValueError("employer_gave_notice no aplica a renuncia voluntaria")
        if self.reason != SettlementReason.renuncia_voluntaria and self.employee_gave_notice is not None:
            if self.reason != SettlementReason.despido_injustificado:
                pass
        return self


class SettlementBreakdownResponse(BaseModel):
    employee_id: int
    employee_name: str
    document_id: str
    hire_date: date
    termination_date: date
    reason: SettlementReason
    contract_type: str
    base_salary: Decimal
    weekly_salary: Decimal
    years_of_service: Decimal
    seniority_bonus: Decimal
    vacation_days: Decimal
    vacation_amount: Decimal
    decimo_amount: Decimal
    decimo_period_label: str
    indemnity_amount: Decimal
    employer_notice_amount: Decimal
    employee_notice_deduction: Decimal
    employer_gave_notice: Optional[bool] = None
    employee_gave_notice: Optional[bool] = None
    gross_total: Decimal
    net_total: Decimal
    notes: List[str] = Field(default_factory=list)


class SettlementCreateRequest(SettlementCalculateRequest):
    apply_termination: bool = True


class SettlementResponse(BaseModel):
    id: int
    employee_id: int
    employee_name: Optional[str] = None
    reason: SettlementReason
    termination_date: date
    contract_type: str
    years_of_service: Decimal
    weekly_salary: Decimal
    base_salary: Decimal
    seniority_bonus: Decimal
    vacation_days: Decimal
    vacation_amount: Decimal
    decimo_amount: Decimal
    indemnity_amount: Decimal
    employer_notice_amount: Decimal
    employee_notice_deduction: Decimal
    gross_total: Decimal
    net_total: Decimal
    employer_gave_notice: Optional[bool] = None
    employee_gave_notice: Optional[bool] = None
    notice_file_url: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
