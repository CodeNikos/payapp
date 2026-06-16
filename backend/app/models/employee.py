from decimal import Decimal

from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, Date, ForeignKey, Enum as SAEnum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from app.core.database import Base


class EmployeeStatus(str, enum.Enum):
    activo = "activo"
    inactivo = "inactivo"
    suspendido = "suspendido"


class ContractType(str, enum.Enum):
    indefinido = "indefinido"
    temporal = "temporal"
    obra_labor = "obra_labor"


SATURDAY_HALF_DAY_HOURS = Decimal("4")


def effective_weekly_hours(employee: "Employee") -> Decimal:
    """Horas semanales de contrato + sábado medio día si aplica."""
    weekly = employee.weekly_contract_hours or Decimal("40")
    if employee.works_saturday_half_day:
        weekly += SATURDAY_HALF_DAY_HOURS
    return weekly


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    employee_code = Column(String(20), unique=True, index=True, nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    document_id = Column(String(20), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=True)
    phone = Column(String(20), nullable=True)
    position = Column(String(150), nullable=False)
    department = Column(String(100), nullable=False)
    base_salary = Column(Numeric(12, 2), nullable=False)
    weekly_contract_hours = Column(Numeric(6, 2), nullable=False, default=40)
    works_saturday_half_day = Column(Boolean, nullable=False, default=False)
    is_trusted_staff = Column(Boolean, nullable=False, default=False)
    hire_date = Column(Date, nullable=False)
    contract_type = Column(SAEnum(ContractType), default=ContractType.indefinido)
    status = Column(SAEnum(EmployeeStatus), default=EmployeeStatus.activo)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    payrolls = relationship("Payroll", back_populates="employee")
    timesheet_entries = relationship("TimesheetEntry", back_populates="employee")

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"
