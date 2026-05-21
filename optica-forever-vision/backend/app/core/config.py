from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "Óptica Forever Vision API"
    APP_VERSION: str = "0.1.0"
    ENV: str = "dev"

    DATABASE_URL: str = "postgresql+psycopg://optica:optica@db:5432/optica"

    JWT_SECRET: str = "dev-secret-change-me-in-prod"
    JWT_ALG: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8  # 8 hs
    JWT_ISSUER: str = "optica-api"
    JWT_AUDIENCE: str = "optica-frontend"

    BACKEND_CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    # Intentos fallidos antes de bloqueo temporal
    LOGIN_MAX_ATTEMPTS: int = 10
    LOGIN_LOCKOUT_SECONDS: int = 900  # 15 minutos

    # WhatsApp Business API (Meta)
    WA_TOKEN: str = ""
    WA_PHONE_ID: str = ""
    WA_BIRTHDAY_TEMPLATE: str = "cumpleanos_optica"
    WA_BIRTHDAY_LANG: str = "es"

    @model_validator(mode="after")
    def validate_secrets(self) -> "Settings":
        if self.ENV == "prod":
            if self.JWT_SECRET.startswith("dev-") or len(self.JWT_SECRET) < 32:
                raise ValueError(
                    "JWT_SECRET debe ser un secreto aleatorio de al menos 32 caracteres en producción. "
                    "Genera uno con: python3 -c \"import secrets; print(secrets.token_urlsafe(48))\""
                )
            if any("localhost" in o or "127.0.0.1" in o for o in self.BACKEND_CORS_ORIGINS):
                raise ValueError(
                    "BACKEND_CORS_ORIGINS no puede contener localhost en producción."
                )
        return self


settings = Settings()
