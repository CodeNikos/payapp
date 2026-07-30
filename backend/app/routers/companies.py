from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, cast, Integer
from typing import List, Optional

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.company import Company, CompanyStatus
from app.models.user import User
from app.schemas.company import CompanyCreate, CompanyUpdate, CompanyResponse

router = APIRouter()


async def _next_company_code(db: AsyncSession) -> str:
    result = await db.execute(
        select(func.max(cast(Company.company_code, Integer)))
    )
    max_code = result.scalar()
    next_n = (max_code or 0) + 1
    return f"{next_n:07d}"


async def _ensure_unique_ruc(
    db: AsyncSession,
    ruc: str,
    exclude_id: Optional[int] = None,
) -> None:
    query = select(Company).where(Company.ruc == ruc)
    if exclude_id is not None:
        query = query.where(Company.id != exclude_id)
    result = await db.execute(query)
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="RUC ya registrado")


@router.get("/", response_model=List[CompanyResponse])
async def list_companies(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status: Optional[CompanyStatus] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Company)
    if status:
        query = query.where(Company.status == status)
    if search:
        q = f"%{search}%"
        query = query.where(
            (Company.commercial_name.ilike(q)) |
            (Company.legal_name.ilike(q)) |
            (Company.ruc.ilike(q)) |
            (Company.company_code.ilike(q))
        )
    result = await db.execute(
        query.order_by(Company.company_code.asc()).offset(skip).limit(limit)
    )
    return [CompanyResponse.model_validate(c) for c in result.scalars().all()]


@router.post("/", response_model=CompanyResponse, status_code=201)
async def create_company(
    data: CompanyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    await _ensure_unique_ruc(db, data.ruc)
    company = Company(
        **data.model_dump(),
        company_code=await _next_company_code(db),
    )
    db.add(company)
    await db.commit()
    await db.refresh(company)
    return CompanyResponse.model_validate(company)


@router.get("/{company_id}", response_model=CompanyResponse)
async def get_company(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return CompanyResponse.model_validate(company)


@router.patch("/{company_id}", response_model=CompanyResponse)
async def update_company(
    company_id: int,
    data: CompanyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    updates = data.model_dump(exclude_unset=True)
    if "ruc" in updates and updates["ruc"] != company.ruc:
        await _ensure_unique_ruc(db, updates["ruc"], exclude_id=company_id)

    for field, value in updates.items():
        setattr(company, field, value)

    await db.commit()
    await db.refresh(company)
    return CompanyResponse.model_validate(company)
