from collections.abc import Callable
from typing import TypeVar

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api_models import (
    GeneratedWorkout,
    GenerateWorkoutRequest,
    UserPreferencesRead,
    UserPreferencesUpdate,
    WorkoutCreate,
)
from app.auth import get_current_user
from app.database import get_db
from app.db_models import User
from app.generator_service import generate_workout
from app.persistence_service import (
    PersistenceConflictError,
    PersistenceUnavailableError,
    PersistenceValidationError,
    create_workout,
)
from app.personalization_service import (
    PersonalizationUnavailableError,
    PersonalizationValidationError,
    build_generation_personalization,
    get_preferences,
    reset_personalization,
    update_preferences,
)

router = APIRouter()
Result = TypeVar("Result")


@router.get("/user-preferences", response_model=UserPreferencesRead)
def read_user_preferences(
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> UserPreferencesRead:
    return _safe_call(lambda: get_preferences(database, user))


@router.put("/user-preferences", response_model=UserPreferencesRead)
def write_user_preferences(
    payload: UserPreferencesUpdate,
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> UserPreferencesRead:
    return _safe_call(lambda: update_preferences(database, user, payload))


@router.post("/user-preferences/reset", response_model=UserPreferencesRead)
def reset_user_personalization(
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> UserPreferencesRead:
    return _safe_call(lambda: reset_personalization(database, user))


@router.post("/workouts/generate/personalized", response_model=GeneratedWorkout)
def create_personalized_workout(
    request: GenerateWorkoutRequest,
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> GeneratedWorkout:
    def operation() -> GeneratedWorkout:
        personalization = build_generation_personalization(database, user, request)
        try:
            generated = generate_workout(request, personalization)
        except ValueError as error:
            raise PersonalizationValidationError(str(error)) from error
        persisted = create_workout(
            database,
            user,
            WorkoutCreate(
                muscle_group=generated.muscle_group,
                difficulty=generated.difficulty,
                equipment=request.equipment,
                goal=request.goal,
                random_seed=request.random_seed,
                blocks=generated.blocks,
            ),
        )
        return generated.model_copy(update={"workout_id": persisted.id})

    return _safe_call(operation)


def _safe_call(operation: Callable[[], Result]) -> Result:
    try:
        return operation()
    except PersonalizationValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except PersonalizationUnavailableError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except PersistenceValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except PersistenceConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except PersistenceUnavailableError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
