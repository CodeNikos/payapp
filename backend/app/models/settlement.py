from sqlalchemy import (
    Column, Integer, String, Numeric, Boolean, DateTime, Date,
    ForeignKey, Text, Enum as SAEnum,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base


class SettlementReason(str, enum.Enum):
    despido_injustificado = "despido_injustificado"
    despido_justificado = "despido_justificado"
    renuncia_voluntaria = "renuncia_voluntaria"


class Settlement(Base):
    __tablename__ = "settlements"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    reason = Column(SAEnum(SettlementReason), nullable=False)
    termination_date = Column(Date, nullable=False)
    contract_type = Column(String(30), nullable=False)
    years_of_service = Column(Numeric(8, 4), nullable=False, default=0)
    weekly_salary = Column(Numeric(12, 2), nullable=False, default=0)
    base_salary = Column(Numeric(12, 2), nullable=False, default=0)

    # Componentes
    seniority_bonus = Column(Numeric(12, 2), nullable=False, default=0)
    vacation_days = Column(Numeric(8, 2), nullable=False, default=0)
    vacation_amount = Column(Numeric(12, 2), nullable=False, default=0)
    decimo_amount = Column(Numeric(12, 2), nullable=False, default=0)
    indemnity_amount = Column(Numeric(12, 2), nullable=False, default=0)
    employer_notice_amount = Column(Numeric(12, 2), nullable=False, default=0)
    employee_notice_deduction = Column(Numeric(12, 2), nullable=False, default=0)
    gross_total = Column(Numeric(12, 2), nullable=False, default=0)
    net_total = Column(Numeric(12, 2), nullable=False, default=0)

    # Preaviso (renuncia o despido)
    employer_gave_notice = Column(Boolean, nullable=True)
    employee_gave_notice = Column(Boolean, nullable=True)
    notice_file_url = Column(String(500), nullable=True)
    notice_file_public_id = Column(String(255), nullable=True)

    notes = Column(Text, nullable=True)
    breakdown_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    employee = relationship("Employee", back_populates="settlements")
