from pydantic import BaseModel, ConfigDict, Field

from app.domain import (
    Difficulty,
    Equipment,
    Intensity,
    MovementPattern,
    MuscleGroup,
    WorkoutGoal,
)


class Song(BaseModel):
    title: str = Field(min_length=1)
    artist: str = Field(min_length=1)
    duration_ms: int = Field(gt=0)


class GenerateWorkoutRequest(BaseModel):
    muscle_group: MuscleGroup
    difficulty: Difficulty
    equipment: list[Equipment] = Field(min_length=1)
    songs: list[Song] = Field(min_length=1)
    goal: WorkoutGoal = WorkoutGoal.endurance
    random_seed: int | None = None


class WorkoutInterval(BaseModel):
    start_seconds: int
    end_seconds: int
    type: str
    exercise: str
    exercise_id: str | None = None


class WorkoutBlock(BaseModel):
    song: Song
    duration_seconds: int
    intervals: list[WorkoutInterval]


class GeneratedWorkout(BaseModel):
    muscle_group: MuscleGroup
    difficulty: Difficulty
    equipment: list[Equipment]
    goal: WorkoutGoal
    blocks: list[WorkoutBlock]


class ExerciseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    primary_muscle_group: MuscleGroup
    secondary_muscle_groups: tuple[MuscleGroup, ...]
    equipment: tuple[Equipment, ...]
    minimum_difficulty: Difficulty
    movement_pattern: MovementPattern
    intensity: Intensity
    instructions: str
    unilateral: bool
    high_impact: bool
    contraindication_notes: str | None
