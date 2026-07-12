from fastapi import APIRouter, HTTPException

from app.api_models import ExerciseResponse, GenerateWorkoutRequest, GeneratedWorkout
from app.domain import Difficulty, Equipment, MuscleGroup
from app.exercise_catalog import filter_exercises
from app.generator_service import generate_workout


router = APIRouter()


@router.get("/")
def health_check() -> dict[str, str]:
    return {"status": "ok", "app": "BeatFit API"}


@router.post("/workouts/generate", response_model=GeneratedWorkout)
def create_workout(request: GenerateWorkoutRequest) -> GeneratedWorkout:
    try:
        return generate_workout(request)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get("/exercises", response_model=list[ExerciseResponse])
def list_exercises(
    muscle_group: MuscleGroup | None = None,
    equipment: Equipment | None = None,
    difficulty: Difficulty | None = None,
) -> list[ExerciseResponse]:
    return [
        ExerciseResponse.model_validate(exercise)
        for exercise in filter_exercises(
            muscle_group=muscle_group,
            equipment=equipment,
            difficulty=difficulty,
        )
    ]
