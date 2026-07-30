from sqlalchemy import (
    Column, Integer, String, Numeric, Boolean, DateTime, Date,
    ForeignKey, Text, Enum as SAEnum,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base


class AbsenceType(str, enum.Enum):
    injustificada = "injustificada"
    incapacidad = "incapacidad"
    maternidad = "maternidad"
    paternidad = "paternidad"
    duelo = "duelo"
    atencion_discapacidad = "atencion_discapacidad"
    matrimonio = "matrimonio"
    otros = "otros"


class AbsenceDeductionMode(str, enum.Enum):
    salario = "salario"
    vacaciones = "vacaciones"


class AbsenceStatus(str, enum.Enum):
    registrada = "registrada"
    aplicada = "aplicada"
    anulada = "anulada"


JUSTIFIED_TYPES = {
    AbsenceType.incapacidad,
    AbsenceType.maternidad,
    AbsenceType.paternidad,
    AbsenceType.duelo,
    AbsenceType.atencion_discapacidad,
    AbsenceType.matrimonio,
    AbsenceType.otros,
}


class Absence(Base):
    __tablename__ = "absences"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    absence_type = Column(SAEnum(AbsenceType), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    days = Column(Numeric(8, 2), nullable=False)
    is_justified = Column(Boolean, nullable=False, default=False)
    deduction_mode = Column(SAEnum(AbsenceDeductionMode), nullable=True)
    evidence_url = Column(String(500), nullable=True)
    evidence_public_id = Column(String(255), nullable=True)
    comments = Column(Text, nullable=True)
    vacation_usage_id = Column(Integer, ForeignKey("vacation_usages.id"), nullable=True)
    payroll_id = Column(Integer, ForeignKey("payrolls.id"), nullable=True)
    status = Column(SAEnum(AbsenceStatus), nullable=False, default=AbsenceStatus.registrada)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    employee = relationship("Employee", back_populates="absences")
    vacation_usage = relationship("VacationUsage", foreign_keys=[vacation_usage_id])
    payroll = relationship("Payroll", foreign_keys=[payroll_id])
