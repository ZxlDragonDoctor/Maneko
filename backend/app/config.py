from pydantic_settings import BaseSettings
from pathlib import Path

class Settings(BaseSettings):
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
    # base_url may include /v1; endpoint is joined as {base}/images/generations
    MIMO_IMAGE_BASE_URL: str = "http://127.0.0.1:7342/v1"
    MIMO_IMAGE_API_KEY: str = ""
    MIMO_IMAGE_MODEL: str = "mimo-image"
    MIMO_IMAGE_SIZE: str = "1024x1024"
    MIMO_IMAGE_TIMEOUT: float = 120.0
    
    # File Storage
    UPLOAD_DIR: Path = Path("uploads")
    COMIC_DIR: Path = Path("comics")
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    
    # CORS
    CORS_ORIGINS: list = ["http://localhost:5173", "http://localhost:3000"]
    
    class Config:
        env_file = ".env"

settings = Settings()

# Ensure directories exist
settings.UPLOAD_DIR.mkdir(exist_ok=True)
settings.COMIC_DIR.mkdir(exist_ok=True)
