from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router as rec_router, train_all_models
from app.config import settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Attempt initial training on startup if DB is reachable
    try:
        train_all_models()
        print("[ML-Service] Initial model training completed successfully.")
    except Exception as e:
        print(f"[ML-Service] Warning: Could not train models on startup: {e}")
    yield

app = FastAPI(
    title="Yeonix Video Recommendation Service",
    description="ML-powered Video Recommendations (Content-Based, Collaborative, Popularity)",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rec_router, prefix="/api/v1")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
