from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.models import GenerateWorkoutRequest, GeneratedWorkout
from app.workout_generator import generate_workout


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


@app.get("/")
def health_check() -> dict[str, str]:
    return {"status": "ok", "app": "BeatFit API"}


@app.post("/workouts/generate", response_model=GeneratedWorkout)
def create_workout(request: GenerateWorkoutRequest) -> GeneratedWorkout:
    return generate_workout(request)
