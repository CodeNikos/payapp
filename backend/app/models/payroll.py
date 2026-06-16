from sqlalchemy import Column, Integer, String, Numeric, DateTime, Date, ForeignKey, Enum as SAEnum, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from app.core.database import Base


class PayrollStatus(str, enum.Enum):
    borrador = "borrador"
    procesado = "procesado"
    pagado = "pagado"
    anulado = "anulado"


class Payroll(Base):
    __tablename__ = "payrolls"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    base_salary = Column(Numeric(12, 2), nullable=False)
    overtime_hours = Column(Numeric(6, 2), default=0)
    overtime_amount = Column(Numeric(12, 2), default=0)
    bonuses = Column(Numeric(12, 2), default=0)
    gross_salary = Column(Numeric(12, 2), nullable=False)

    # Deducciones
    social_security = Column(Numeric(12, 2), default=0)
    educational_insurance = Column(Numeric(12, 2), default=0)
    income_tax = Column(Numeric(12, 2), default=0)
    other_deductions = Column(Numeric(12, 2), default=0)
    total_deductions = Column(Numeric(12, 2), nullable=False)

    net_salary = Column(Numeric(12, 2), nullable=False)
    status = Column(SAEnum(PayrollStatus), default=PayrollStatus.borrador)
    payment_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    employee = relationship("Employee", back_populates="payrolls")
