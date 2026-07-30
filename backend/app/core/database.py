from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text
from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def run_migrations():
    """Aplica cambios incrementales en bases de datos existentes."""
    async with engine.begin() as conn:
        # Migración legacy: monthly_contract_hours → weekly_contract_hours
        await conn.execute(text(
            "ALTER TABLE employees "
            "ADD COLUMN IF NOT EXISTS weekly_contract_hours NUMERIC(6, 2)"
        ))
        await conn.execute(text("""
            DO $$
            BEGIN
              IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'employees' AND column_name = 'monthly_contract_hours'
              ) THEN
                UPDATE employees
                SET weekly_contract_hours = monthly_contract_hours / 4
                WHERE weekly_contract_hours IS NULL;
              END IF;
            END $$
        """))
        await conn.execute(text(
            "UPDATE employees SET weekly_contract_hours = 40 WHERE weekly_contract_hours IS NULL"
        ))
        await conn.execute(text(
            "ALTER TABLE employees ALTER COLUMN weekly_contract_hours SET DEFAULT 40"
        ))
        await conn.execute(text(
            "ALTER TABLE employees ALTER COLUMN weekly_contract_hours SET NOT NULL"
        ))
        await conn.execute(text(
            "ALTER TABLE employees DROP COLUMN IF EXISTS monthly_contract_hours"
        ))
        await conn.execute(text(
            "ALTER TABLE employees "
            "ADD COLUMN IF NOT EXISTS works_saturday_half_day BOOLEAN NOT NULL DEFAULT FALSE"
        ))
        await conn.execute(text(
            "ALTER TABLE payrolls "
            "ADD COLUMN IF NOT EXISTS educational_insurance NUMERIC(12, 2) NOT NULL DEFAULT 0"
        ))
        # Recalcular seguro educativo en nóminas creadas antes del campo (1.25% del bruto)
        await conn.execute(text("""
            UPDATE payrolls
            SET educational_insurance = ROUND(gross_salary * 0.0125, 2)
            WHERE educational_insurance = 0 AND gross_salary > 0
        """))
        await conn.execute(text("""
            UPDATE payrolls
            SET total_deductions = social_security + educational_insurance + income_tax,
                net_salary = gross_salary - social_security - educational_insurance - income_tax - other_deductions
            WHERE educational_insurance > 0
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS holidays (
                id SERIAL PRIMARY KEY,
                holiday_date DATE NOT NULL,
                year INTEGER NOT NULL,
                name VARCHAR(200) NOT NULL,
                description VARCHAR(500),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ,
                CONSTRAINT uq_holidays_holiday_date UNIQUE (holiday_date)
            )
        """))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_holidays_year ON holidays (year)"
        ))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_holidays_holiday_date ON holidays (holiday_date)"
        ))
        await conn.execute(text(
            "ALTER TABLE employees "
            "ADD COLUMN IF NOT EXISTS is_trusted_staff BOOLEAN NOT NULL DEFAULT FALSE"
        ))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS timesheet_entries (
                id SERIAL PRIMARY KEY,
                employee_id INTEGER NOT NULL REFERENCES employees(id),
                work_date DATE NOT NULL,
                clock_in TIME,
                clock_out TIME,
                overtime_start TIME,
                overtime_end TIME,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ,
                CONSTRAINT uq_timesheet_employee_date UNIQUE (employee_id, work_date)
            )
        """))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_timesheet_employee_id ON timesheet_entries (employee_id)"
        ))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_timesheet_work_date ON timesheet_entries (work_date)"
        ))
        await conn.execute(text(
            "ALTER TABLE employees "
            "ADD COLUMN IF NOT EXISTS termination_date DATE"
        ))
        await conn.execute(text(
            "ALTER TABLE payrolls "
            "ADD COLUMN IF NOT EXISTS commissions NUMERIC(12, 2) NOT NULL DEFAULT 0"
        ))
        await conn.execute(text(
            "ALTER TABLE payrolls "
            "ADD COLUMN IF NOT EXISTS payroll_type VARCHAR(20) NOT NULL DEFAULT 'regular'"
        ))
        await conn.execute(text(
            "ALTER TABLE payrolls "
            "ADD COLUMN IF NOT EXISTS decimo_accrued_total NUMERIC(12, 2)"
        ))
        await conn.execute(text(
            "ALTER TABLE payrolls "
            "ADD COLUMN IF NOT EXISTS cuatrimestre INTEGER"
        ))
        await conn.execute(text(
            "ALTER TABLE payrolls "
            "ADD COLUMN IF NOT EXISTS cuatrimestre_year INTEGER"
        ))
        await conn.execute(text(
            "ALTER TABLE employees "
            "ADD COLUMN IF NOT EXISTS vacation_opening_balance NUMERIC(8, 2) NOT NULL DEFAULT 0"
        ))
        await conn.execute(text(
            "ALTER TABLE employees "
            "ADD COLUMN IF NOT EXISTS vacation_opening_balance_date DATE"
        ))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS vacation_usages (
                id SERIAL PRIMARY KEY,
                employee_id INTEGER NOT NULL REFERENCES employees(id),
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                usage_date DATE NOT NULL,
                days NUMERIC(8, 2) NOT NULL,
                amount NUMERIC(12, 2) NOT NULL,
                notes TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ
            )
        """))
        await conn.execute(text(
            "ALTER TABLE vacation_usages ADD COLUMN IF NOT EXISTS start_date DATE"
        ))
        await conn.execute(text(
            "ALTER TABLE vacation_usages ADD COLUMN IF NOT EXISTS end_date DATE"
        ))
        await conn.execute(text("""
            UPDATE vacation_usages
            SET start_date = usage_date
            WHERE start_date IS NULL AND usage_date IS NOT NULL
        """))
        await conn.execute(text("""
            UPDATE vacation_usages
            SET end_date = usage_date
            WHERE end_date IS NULL AND usage_date IS NOT NULL
        """))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_vacation_usages_employee_id ON vacation_usages (employee_id)"
        ))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_vacation_usages_usage_date ON vacation_usages (usage_date)"
        ))
        await conn.execute(text("""
            DO $$ BEGIN
                CREATE TYPE companystatus AS ENUM ('activo', 'cancelado');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS companies (
                id SERIAL PRIMARY KEY,
                company_code VARCHAR(20) NOT NULL UNIQUE,
                commercial_name VARCHAR(200) NOT NULL,
                legal_name VARCHAR(200) NOT NULL,
                ruc VARCHAR(40) NOT NULL UNIQUE,
                dv VARCHAR(10) NOT NULL,
                status companystatus NOT NULL DEFAULT 'activo',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ
            )
        """))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_companies_company_code ON companies (company_code)"
        ))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_companies_status ON companies (status)"
        ))
        await conn.execute(text(
            "ALTER TABLE employees "
            "ADD COLUMN IF NOT EXISTS company_code VARCHAR(20)"
        ))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_employees_company_code ON employees (company_code)"
        ))
        await conn.execute(text("""
            DO $$ BEGIN
                ALTER TABLE employees
                ADD CONSTRAINT fk_employees_company_code
                FOREIGN KEY (company_code) REFERENCES companies(company_code);
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$
        """))
        await conn.execute(text("""
            DO $$ BEGIN
                CREATE TYPE absencetype AS ENUM (
                    'injustificada', 'incapacidad', 'maternidad', 'paternidad',
                    'duelo', 'atencion_discapacidad', 'matrimonio', 'otros'
                );
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$
        """))
        await conn.execute(text("""
            DO $$ BEGIN
                CREATE TYPE absencedeductionmode AS ENUM ('salario', 'vacaciones');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$
        """))
        await conn.execute(text("""
            DO $$ BEGIN
                CREATE TYPE absencestatus AS ENUM ('registrada', 'aplicada', 'anulada');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS absences (
                id SERIAL PRIMARY KEY,
                employee_id INTEGER NOT NULL REFERENCES employees(id),
                absence_type absencetype NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                days NUMERIC(8, 2) NOT NULL,
                is_justified BOOLEAN NOT NULL DEFAULT FALSE,
                deduction_mode absencedeductionmode,
                evidence_url VARCHAR(500),
                evidence_public_id VARCHAR(255),
                comments TEXT,
                vacation_usage_id INTEGER REFERENCES vacation_usages(id),
                payroll_id INTEGER REFERENCES payrolls(id),
                status absencestatus NOT NULL DEFAULT 'registrada',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ
            )
        """))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_absences_employee_id ON absences (employee_id)"
        ))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_absences_start_date ON absences (start_date)"
        ))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_absences_status ON absences (status)"
        ))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_absences_absence_type ON absences (absence_type)"
        ))

        # Liquidaciones / cese
        await conn.execute(text("""
            DO $$ BEGIN
                CREATE TYPE settlementreason AS ENUM (
                    'despido_injustificado', 'despido_justificado', 'renuncia_voluntaria'
                );
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS settlements (
                id SERIAL PRIMARY KEY,
                employee_id INTEGER NOT NULL REFERENCES employees(id),
                reason settlementreason NOT NULL,
                termination_date DATE NOT NULL,
                contract_type VARCHAR(30) NOT NULL,
                years_of_service NUMERIC(8, 4) NOT NULL DEFAULT 0,
                weekly_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
                base_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
                seniority_bonus NUMERIC(12, 2) NOT NULL DEFAULT 0,
                vacation_days NUMERIC(8, 2) NOT NULL DEFAULT 0,
                vacation_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
                decimo_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
                indemnity_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
                employer_notice_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
                employee_notice_deduction NUMERIC(12, 2) NOT NULL DEFAULT 0,
                gross_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
                net_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
                employer_gave_notice BOOLEAN,
                employee_gave_notice BOOLEAN,
                notice_file_url VARCHAR(500),
                notice_file_public_id VARCHAR(255),
                notes TEXT,
                breakdown_json TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ
            )
        """))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_settlements_employee_id ON settlements (employee_id)"
        ))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_settlements_termination_date ON settlements (termination_date)"
        ))
