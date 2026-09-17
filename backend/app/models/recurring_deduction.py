from sqlalchemy import (
    Column, Integer, String, Numeric, Boolean, DateTime, Date,
    ForeignKey, Enum as SAEnum,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base


class DeductionFrequency(str, enum.Enum):
    mensual = "mensual"
    quincenal = "quincenal"


class EmployeeRecurringDeduction(Base):
    __tablename__ = "employee_recurring_deductions"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    concept = Column(String(200), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    frequency = Column(SAEnum(DeductionFrequency), nullable=False)
    monthly_quincena = Column(Integer, nullable=True)  # 1 o 2 si frequency=mensual
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    employee = relationship("Employee", back_populates="recurring_deductions")
