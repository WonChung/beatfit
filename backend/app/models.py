"""Backward-compatible exports for older BeatFit imports."""

from app.api_models import (  # noqa: F401
    ExerciseResponse,
    GeneratedWorkout,
    GenerateWorkoutRequest,
    Song,
    WorkoutBlock,
    WorkoutInterval,
)
from app.domain import (  # noqa: F401
    Difficulty,
    Equipment,
    Exercise,
    Intensity,
    MovementPattern,
    MuscleGroup,
    WorkoutGoal,
)

__all__ = [
    "Difficulty",
    "Equipment",
    "Exercise",
    "ExerciseResponse",
    "GenerateWorkoutRequest",
    "GeneratedWorkout",
    "Intensity",
    "MovementPattern",
    "MuscleGroup",
    "Song",
    "WorkoutBlock",
    "WorkoutGoal",
    "WorkoutInterval",
]
