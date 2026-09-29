"""Filtro opcional de alcance por empresa (company_code)."""
from __future__ import annotations

from typing import Optional

from fastapi import HTTPException
from sqlalchemy import Select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.company import Company, CompanyStatus
from app.models.employee import Employee

# Valor especial del query param: empleados sin empresa asignada
NONE_COMPANY = "__none__"


def normalize_company_filter(company_code: Optional[str]) -> Optional[str]:
    if company_code is None:
        return None
    raw = company_code.strip()
    if not raw or raw.lower() in ("all", "todas", "*"):
        return None
    return raw


def apply_employee_company_filter(query: Select, company_code: Optional[str]) -> Select:
    """
    Aplica filtro sobre Employee.company_code.
    - None / vacío / 'all' → sin filtro (todas)
    - '__none__' → solo empleados sin empresa
    - otro valor → igualdad exacta
    """
    code = normalize_company_filter(company_code)
    if code is None:
        return query
    if code == NONE_COMPANY:
        return query.where(Employee.company_code.is_(None))
    return query.where(Employee.company_code == code)


def employee_matches_company(employee: Employee, company_code: Optional[str]) -> bool:
    code = normalize_company_filter(company_code)
    if code is None:
        return True
    if code == NONE_COMPANY:
        return employee.company_code is None
    return employee.company_code == code


async def assert_company_filter_valid(db: AsyncSession, company_code: Optional[str]) -> Optional[str]:
    """Valida que el código exista (excepto __none__ / todas). Devuelve el código normalizado."""
    code = normalize_company_filter(company_code)
    if code is None or code == NONE_COMPANY:
        return code
    result = await db.execute(select(Company).where(Company.company_code == code))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=400, detail="Empresa no encontrada")
    if company.status == CompanyStatus.cancelado:
        raise HTTPException(status_code=400, detail="La empresa está cancelada")
    return code
