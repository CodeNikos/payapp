from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime


class HolidayBase(BaseModel):
    holiday_date: date
    name: str = Field(min_length=2, max_length=200)
    description: Optional[str] = Field(default=None, max_length=500)


class HolidayCreate(HolidayBase):
    pass


class HolidayUpdate(BaseModel):
    holiday_date: Optional[date] = None
    name: Optional[str] = Field(default=None, min_length=2, max_length=200)
    description: Optional[str] = Field(default=None, max_length=500)


class HolidayResponse(HolidayBase):
    id: int
    year: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class HolidayImportRowError(BaseModel):
    row: int
    message: str


class HolidayImportResult(BaseModel):
    created: int
    skipped: int
    errors: List[HolidayImportRowError]
