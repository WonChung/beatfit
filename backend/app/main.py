from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import router
from app.persistence_routes import router as persistence_router
from app.apple_music_routes import router as apple_music_router
from app.personalization_routes import router as personalization_router


app = FastAPI(title="BeatFit API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8081",
        "http://127.0.0.1:8081",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(persistence_router)
app.include_router(apple_music_router)
app.include_router(personalization_router)
