from sqlalchemy import Column, Integer, String, DateTime, Enum as SAEnum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from app.core.database import Base


class CompanyStatus(str, enum.Enum):
    activo = "activo"
    cancelado = "cancelado"


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    company_code = Column(String(20), unique=True, index=True, nullable=False)
    commercial_name = Column(String(200), nullable=False)
    legal_name = Column(String(200), nullable=False)
    ruc = Column(String(40), unique=True, nullable=False)
    dv = Column(String(10), nullable=False)
    status = Column(SAEnum(CompanyStatus), default=CompanyStatus.activo, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    employees = relationship("Employee", back_populates="company")
