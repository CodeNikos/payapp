from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import date, datetime
from decimal import Decimal
from app.models.employee import EmployeeStatus, ContractType


class EmployeeBase(BaseModel):
    first_name: str
    last_name: str
    document_id: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    position: str
    department: str
    base_salary: Decimal
    weekly_contract_hours: Decimal = Field(default=Decimal("40"), gt=0, le=168)
    works_saturday_half_day: bool = False
    is_trusted_staff: bool = False
    hire_date: date
    contract_type: ContractType = ContractType.indefinido


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    document_id: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    position: Optional[str] = None
    department: Optional[str] = None
    base_salary: Optional[Decimal] = None
    weekly_contract_hours: Optional[Decimal] = Field(default=None, gt=0, le=168)
    works_saturday_half_day: Optional[bool] = None
    is_trusted_staff: Optional[bool] = None
    hire_date: Optional[date] = None
    contract_type: Optional[ContractType] = None
    status: Optional[EmployeeStatus] = None


class EmployeeResponse(EmployeeBase):
    id: int
    employee_code: str
    status: EmployeeStatus
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
