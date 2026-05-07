from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Placeholder for settings until Task 1.2
# from app.config import settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Lifespan context manager placeholder
    yield

app = FastAPI(
    title="MeetIO API",
    version="0.1.0",
    lifespan=lifespan
)

# CORS Middleware placeholder
# origins = [settings.FRONTEND_URL]
origins = ["*"] # Temporary placeholder

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "MeetIO API is running"}

@app.get("/health")
async def health():
    return {"status": "ok"}

# Router inclusions will be added as they are developed
