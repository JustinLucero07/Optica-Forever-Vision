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

    BACKEND_CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    # WhatsApp Business API (Meta)
    WA_TOKEN: str = ""       # Bearer token from Meta Business Manager
    WA_PHONE_ID: str = ""    # Phone number ID from Meta Business Manager
    WA_BIRTHDAY_TEMPLATE: str = "cumpleanos_optica"  # Template name approved in Meta
    WA_BIRTHDAY_LANG: str = "es"


settings = Settings()
