from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from app.config import settings
from app.database import engine, Base, SessionLocal
from app.routers import novels, chapters, comics, library
from app.schema_migrate import ensure_schema

# Create tables
Base.metadata.create_all(bind=engine)
ensure_schema()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Recover chapters that finished writing panels but lost DB status
    try:
        from app.services.comic_service import ComicService

        db = SessionLocal()
        try:
            recovered = ComicService(db).recover_stuck_chapters()
            if recovered:
                print(f"Recovered {recovered} stuck comic chapter(s) from disk")
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.mount("/comics", StaticFiles(directory="comics"), name="comics")

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

