from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import router
from app.persistence_routes import router as persistence_router


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
