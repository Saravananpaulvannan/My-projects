from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite:///./Backend/aradhaya_crackers.db"
    cors_origins: str = "http://localhost:5173"
    admin_name: str = "Admin"
    admin_phone: str = ""
    admin_password_hash: str = ""
    session_cookie_secure: bool = False
    session_ttl_hours: int = 12
    upload_dir: Path = Path(__file__).resolve().parents[1] / "uploads"

    model_config = SettingsConfigDict(env_file=Path(__file__).resolve().parents[1] / ".env", extra="ignore")

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()