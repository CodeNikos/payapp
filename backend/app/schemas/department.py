from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class DepartmentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    is_active: bool = True


class DepartmentUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    is_active: Optional[bool] = None


class DepartmentResponse(BaseModel):
    id: int
    name: str
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
