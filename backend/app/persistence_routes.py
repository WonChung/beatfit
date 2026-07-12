from collections.abc import Callable
from typing import TypeVar
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.api_models import (
    Page,
    PersistedWorkout,
    PersistedWorkoutSession,
    WorkoutCreate,
    WorkoutSessionCreate,
    WorkoutSessionUpdate,
)
from app.database import get_db
from app.auth import get_current_user
from app.db_models import User
from app.persistence_service import (
    PersistenceConflictError,
    PersistenceNotFoundError,
    PersistenceUnavailableError,
    PersistenceValidationError,
    create_session,
    create_workout,
    delete_workout,
    get_workout,
    list_sessions,
    list_workouts,
    update_session,
)


router = APIRouter()
Result = TypeVar("Result")


@router.post("/workouts", response_model=PersistedWorkout, status_code=status.HTTP_201_CREATED)
def persist_workout(
    payload: WorkoutCreate,
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> PersistedWorkout:
    return _safe_database_call(lambda: create_workout(database, user, payload))


@router.get("/workouts", response_model=Page[PersistedWorkout])
def get_workouts(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> Page[PersistedWorkout]:
    return _safe_database_call(lambda: list_workouts(database, user, page, page_size))


@router.get("/workouts/{workout_id}", response_model=PersistedWorkout)
def get_persisted_workout(
    workout_id: UUID,
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> PersistedWorkout:
    return _safe_database_call(lambda: get_workout(database, user, workout_id))


@router.delete("/workouts/{workout_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_workout(
    workout_id: UUID,
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> Response:
    _safe_database_call(lambda: delete_workout(database, user, workout_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/workout-sessions",
    response_model=PersistedWorkoutSession,
    status_code=status.HTTP_201_CREATED,
)
def persist_session(
    payload: WorkoutSessionCreate,
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> PersistedWorkoutSession:
    return _safe_database_call(lambda: create_session(database, user, payload))


@router.patch("/workout-sessions/{session_id}", response_model=PersistedWorkoutSession)
def patch_session(
    session_id: UUID,
    payload: WorkoutSessionUpdate,
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> PersistedWorkoutSession:
    return _safe_database_call(lambda: update_session(database, user, session_id, payload))


@router.get("/workout-sessions", response_model=Page[PersistedWorkoutSession])
def get_sessions(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> Page[PersistedWorkoutSession]:
    return _safe_database_call(lambda: list_sessions(database, user, page, page_size))


def _safe_database_call(operation: Callable[[], Result]) -> Result:
    try:
        return operation()
    except PersistenceNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except PersistenceValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except PersistenceConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except PersistenceUnavailableError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
