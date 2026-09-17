from pydantic import BaseModel, Field
from typing import List
from decimal import Decimal


class SipeReportRow(BaseModel):
    employee_id: int
    document_type: str
    document_id: str
    social_security_number: str
    first_name: str
    last_name: str
    sueldo: Decimal
    horas_extras: Decimal
    impuesto_renta: Decimal
    decimo: Decimal
    vacaciones: Decimal
    comisiones: Decimal
    bonificaciones: Decimal
    combustible: Decimal
    dieta: Decimal
    salario_especie: Decimal
    viaticos: Decimal
    gasto_representacion: Decimal
    isr_gasto_representacion: Decimal
    decimo_gasto_representacion: Decimal
    primas_produccion: Decimal
    dividendo: Decimal
    participacion_beneficios: Decimal
    gratificacion: Decimal
    preaviso: Decimal
    indemnizacion: Decimal
    missing_nss: bool = False


class SipeReportPreviewResponse(BaseModel):
    year: int
    month: int = Field(ge=1, le=12)
    items: List[SipeReportRow]
    warnings: List[str] = []
