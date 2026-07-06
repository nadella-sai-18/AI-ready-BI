from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment / .env file."""

    APP_NAME: str = "AI-Ready BI — College Analytics API"
    APP_VERSION: str = "0.1.0"

    # Connects to the EXISTING PostgreSQL from docker/docker-compose.yml (host port 5433).
    DATABASE_URL: str = "postgresql+psycopg2://admin:admin123@localhost:5433/lms_db"

    # Comma-separated list of allowed CORS origins.
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
