from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from pathlib import Path
from typing import List, Union
import json
import os


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_NAME: str = "Maneko · 漫猫"
    VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "sqlite:///./novels.db"

    # DashScope
    DASHSCOPE_API_KEY: str = ""
    QWEN_MODEL: str = "qwen3.8-max"
    WANX_MODEL: str = "wanx-v1"

    # Qwen image (DashScope) — verified working IDs: qwen-image, qwen-image-plus
    QWEN_IMAGE_MODEL: str = "qwen-image"
    QWEN_IMAGE_SIZE: str = "1024*1024"
    QWEN_IMAGE_NEGATIVE_PROMPT: str = (
        "text, watermark, logo, lowres, blurry, daytime bright sun, pastel colors, "
        "white background, deformed hands, extra fingers"
    )
    # sdk | http | openai — how to call DashScope for qwen-image
    QWEN_IMAGE_MODE: str = "sdk"

    # Image provider: wanx | mimo | mock | qwen
    IMAGE_PROVIDER: str = "mock"

    # Visual style for generated panels (must match UI: Neon Tokyo)
    COMIC_STYLE: str = "neon-tokyo"

    # MiMo image generation (OpenAI-compatible /v1/images/generations)
    MIMO_IMAGE_BASE_URL: str = "http://127.0.0.1:7342/v1"
    MIMO_IMAGE_API_KEY: str = ""
    MIMO_IMAGE_MODEL: str = "mimo-image"
    MIMO_IMAGE_SIZE: str = "1024x1024"
    MIMO_IMAGE_TIMEOUT: float = 120.0

    # File Storage
    UPLOAD_DIR: Path = Path("uploads")
    COMIC_DIR: Path = Path("comics")
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB

    # CORS — JSON array or comma-separated origins
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors(cls, v):
        if isinstance(v, list):
            origins = [str(origin).strip() for origin in v if str(origin).strip()]
            if any("*" in origin for origin in origins):
                raise ValueError("CORS_ORIGINS must contain explicit origins; wildcard patterns are unsupported")
            return origins
        if not v:
            return []
        s = str(v).strip()
        if s.startswith("["):
            try:
                parsed = json.loads(s)
                if isinstance(parsed, list):
                    origins = [str(x).strip() for x in parsed if str(x).strip()]
                    if any("*" in origin for origin in origins):
                        raise ValueError("CORS_ORIGINS must contain explicit origins; wildcard patterns are unsupported")
                    return origins
            except json.JSONDecodeError:
                pass
        origins = [p.strip() for p in s.split(",") if p.strip()]
        if any("*" in origin for origin in origins):
            raise ValueError("CORS_ORIGINS must contain explicit origins; wildcard patterns are unsupported")
        return origins


settings = Settings()

# Ensure directories exist (serverless-friendly paths already absolute if provided)
settings.UPLOAD_DIR = Path(settings.UPLOAD_DIR)
settings.COMIC_DIR = Path(settings.COMIC_DIR)
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.COMIC_DIR.mkdir(parents=True, exist_ok=True)
