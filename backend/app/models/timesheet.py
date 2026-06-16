from sqlalchemy import Column, Integer, Date, Time, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class TimesheetEntry(Base):
    __tablename__ = "timesheet_entries"
    __table_args__ = (
        UniqueConstraint("employee_id", "work_date", name="uq_timesheet_employee_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    work_date = Column(Date, nullable=False, index=True)
    clock_in = Column(Time, nullable=True)
    clock_out = Column(Time, nullable=True)
    overtime_start = Column(Time, nullable=True)
    overtime_end = Column(Time, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    employee = relationship("Employee", back_populates="timesheet_entries")
