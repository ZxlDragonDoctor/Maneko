from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from ipaddress import ip_address
from sqlalchemy import text
from urllib.parse import urlsplit

from app.config import settings
from app.database import engine, Base, SessionLocal
from app.routers import novels, chapters, comics, library
from app.schema_migrate import ensure_schema


class UploadBodyTooLarge(Exception):
    pass


class UploadBodySizeLimitMiddleware:
    """Bound multipart bytes as they arrive, including requests without Content-Length."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope.get("path") != "/api/novels/upload":
            await self.app(scope, receive, send)
            return

        limit = settings.MAX_UPLOAD_SIZE + 128 * 1024
        headers = dict(scope.get("headers", []))
        content_length = headers.get(b"content-length")
        if content_length:
            try:
                request_bytes = int(content_length)
            except ValueError:
                response = JSONResponse(status_code=400, content={"detail": "无效的 Content-Length"})
                await response(scope, receive, send)
                return
            if request_bytes > limit:
                response = JSONResponse(
                    status_code=413,
                    content={"detail": f"请求大小不能超过 {settings.MAX_UPLOAD_SIZE} 字节"},
                )
                await response(scope, receive, send)
                return

        received = 0

        async def limited_receive():
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
                    raise UploadBodyTooLarge
            return message

        try:
            await self.app(scope, limited_receive, send)
        except UploadBodyTooLarge:
            response = JSONResponse(
                status_code=413,
                content={"detail": f"请求大小不能超过 {settings.MAX_UPLOAD_SIZE} 字节"},
            )
            await response(scope, receive, send)


# Create tables
Base.metadata.create_all(bind=engine)
ensure_schema()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Surface interrupted comic generations as retryable errors, preserving prior/partial panels.
    try:
        from app.services.comic_service import ComicService

        db = SessionLocal()
        try:
            recovered = ComicService(db).recover_stuck_chapters()
            if recovered:
                print(f"Marked {recovered} interrupted comic generation(s) as retryable")
        finally:
            db.close()
    except Exception as e:
        print(f"comic recovery skipped: {e}")

    # Best-effort Gutenberg catalog warm
    try:
        from app.services import gutenberg_catalog as pg

        if not pg.load_catalog():
            await pg.download_catalog()
    except Exception as e:
        print(f"Gutenberg catalog warmup skipped: {e}")

    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    debug=settings.DEBUG,
    lifespan=lifespan,
)

# CORS
app.add_middleware(UploadBodySizeLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files
app.mount("/uploads", StaticFiles(directory=str(settings.UPLOAD_DIR)), name="uploads")
app.mount("/comics", StaticFiles(directory=str(settings.COMIC_DIR)), name="comics")

# Routers
app.include_router(novels.router, prefix="/api/novels", tags=["novels"])
app.include_router(chapters.router, prefix="/api", tags=["chapters"])
app.include_router(comics.router, prefix="/api/comics", tags=["comics"])
app.include_router(library.router, prefix="/api/library", tags=["library"])


@app.get("/")
async def root():
    return {"message": "Maneko · 漫猫 API", "docs": "/docs"}

@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/ready")
async def ready():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception:
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready", "dependency": "database"},
        )
    provider = settings.IMAGE_PROVIDER.strip().lower()
    dashscope_key = settings.DASHSCOPE_API_KEY.strip()
    if not dashscope_key or dashscope_key.lower().startswith(("your-", "changeme", "replace-")):
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready", "dependency": "chapter_model_configuration"},
        )
    if provider == "mock":
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready", "dependency": "production_image_provider"},
        )
    if provider == "mimo" and not settings.MIMO_IMAGE_API_KEY.strip():
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready", "dependency": "image_provider_credentials"},
        )
    if provider == "mimo":
        try:
            endpoint = urlsplit(settings.MIMO_IMAGE_BASE_URL.strip())
            host = (endpoint.hostname or "").lower().rstrip(".")
            try:
                ip = ip_address(host) if host else None
            except ValueError:
                ip = None
            invalid_host = (
                host in {"localhost", "0.0.0.0"}
                or host in {"example.com", "example.org", "example.net"}
                or host.endswith((".localhost", ".local", ".example", ".example.com", ".invalid", ".test"))
                or (ip is not None and (ip.is_loopback or ip.is_unspecified))
            )
            invalid_endpoint = (
                endpoint.scheme not in {"http", "https"}
                or not host
                or endpoint.username is not None
                or endpoint.password is not None
                or invalid_host
            )
        except ValueError:
            invalid_endpoint = True
        if invalid_endpoint:
            return JSONResponse(
                status_code=503,
                content={"status": "not_ready", "dependency": "image_provider_endpoint"},
            )
    if provider not in {"qwen", "qwen-image", "qwen_image", "qwen-image-3.0", "wanx", "dashscope-wanx", "mimo"}:
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready", "dependency": "image_provider_configuration"},
        )
    return {"status": "ready"}

