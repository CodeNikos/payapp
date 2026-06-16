from pydantic import BaseModel, model_validator
from typing import Optional, List
from datetime import date, time, datetime


class TimesheetDayBase(BaseModel):
    work_date: date
    clock_in: Optional[time] = None
    clock_out: Optional[time] = None
    overtime_start: Optional[time] = None
    overtime_end: Optional[time] = None

    @model_validator(mode="after")
    def validate_times(self):
        if self.clock_in and self.clock_out and self.clock_out <= self.clock_in:
            raise ValueError(f"{self.work_date}: la salida debe ser posterior a la entrada")
        if self.overtime_start and self.overtime_end and self.overtime_end <= self.overtime_start:
            raise ValueError(f"{self.work_date}: hora extra fin debe ser posterior al inicio")
        return self


class TimesheetDayResponse(TimesheetDayBase):
    id: int
    employee_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class TimesheetBulkUpsert(BaseModel):
    employee_id: int
    entries: List[TimesheetDayBase]


class TimesheetValidationResult(BaseModel):
    employee_id: int
    is_complete: bool
    missing_dates: List[str]
    is_trusted_staff: bool
