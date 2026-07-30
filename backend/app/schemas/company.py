from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.models.company import CompanyStatus


class CompanyBase(BaseModel):
    commercial_name: str = Field(..., min_length=1, max_length=200)
    legal_name: str = Field(..., min_length=1, max_length=200)
    ruc: str = Field(..., min_length=1, max_length=40)
    dv: str = Field(..., min_length=1, max_length=10)


class CompanyCreate(CompanyBase):
    status: CompanyStatus = CompanyStatus.activo


class CompanyUpdate(BaseModel):
    commercial_name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    legal_name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    ruc: Optional[str] = Field(default=None, min_length=1, max_length=40)
    dv: Optional[str] = Field(default=None, min_length=1, max_length=10)
    status: Optional[CompanyStatus] = None


class CompanyResponse(CompanyBase):
    id: int
    company_code: str
    status: CompanyStatus
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
