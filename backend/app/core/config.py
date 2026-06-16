from pydantic_settings import BaseSettings
from pydantic import field_validator
from pathlib import Path
from typing import List, Any
import json
import secrets

BASE_DIR = Path(__file__).resolve().parent.parent.parent


def _parse_str_list(value: Any) -> List[str] | Any:
    """Acepta JSON, CSV o un solo valor (formato típico en dashboards PaaS)."""
    if value is None:
        return value
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return []
        if raw.startswith("["):
            return json.loads(raw)
        return [item.strip() for item in raw.split(",") if item.strip()]
    return value


class Settings(BaseSettings):
    # App
    APP_NAME: str = "PayApp"
    DEBUG: bool = False
    SECRET_KEY: str = secrets.token_urlsafe(64)

    # Database
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str = "payapp"
    DB_USER: str = "payadmin"
    DB_PASSWORD: str = "Adminpa01"

    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    @property
    def DATABASE_URL_SYNC(self) -> str:
        return f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    # JWT
    JWT_SECRET_KEY: str = secrets.token_urlsafe(64)
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Security
    BCRYPT_ROUNDS: int = 12
    MAX_LOGIN_ATTEMPTS: int = 5
    LOCKOUT_DURATION_MINUTES: int = 15

    # CORS / hosts (Seenode: https://payapp.seenode.app o JSON ["https://..."])
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
    ]
    ALLOWED_HOSTS: List[str] = ["localhost", "127.0.0.1"]

    @field_validator("ALLOWED_ORIGINS", "ALLOWED_HOSTS", mode="before")
    @classmethod
    def parse_list_env(cls, value: Any) -> Any:
        return _parse_str_list(value)

    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    AUTH_RATE_LIMIT_PER_MINUTE: int = 10

    class Config:
        env_file = str(BASE_DIR / '.env')
        case_sensitive = True


settings = Settings()
