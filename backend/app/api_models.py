from datetime import datetime
from typing import Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.domain import (
    Difficulty,
    Equipment,
    FeedbackRating,
    Intensity,
    MovementPattern,
    MuscleGroup,
    SessionStatus,
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


class WorkoutCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, max_length=160)
    muscle_group: MuscleGroup
    difficulty: Difficulty
    equipment: list[Equipment] = Field(min_length=1)
    goal: WorkoutGoal = WorkoutGoal.endurance
    random_seed: int | None = None
    blocks: list[WorkoutBlock] = Field(min_length=1)
    saved_name: str | None = Field(default=None, min_length=1, max_length=160)
    is_favorite: bool = False


class PersistedWorkout(BaseModel):
    id: UUID
    name: str | None
    muscle_group: MuscleGroup
    difficulty: Difficulty
    equipment: list[Equipment]
    goal: WorkoutGoal
    random_seed: int | None
    blocks: list[WorkoutBlock]
    created_at: datetime
    updated_at: datetime


class FeedbackWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rating: FeedbackRating
    notes: str | None = Field(default=None, max_length=2000)


class FeedbackRead(FeedbackWrite):
    id: UUID
    created_at: datetime
    updated_at: datetime


class WorkoutSessionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    workout_id: UUID
    started_at: datetime
    ended_at: datetime
    actual_elapsed_seconds: int = Field(ge=0)
    completed_intervals: int = Field(ge=0)
    completed_work_intervals: int = Field(ge=0)
    completed_song_blocks: int = Field(ge=0)
    status: SessionStatus
    feedback: FeedbackWrite | None = None

    @model_validator(mode="after")
    def validate_times(self) -> "WorkoutSessionCreate":
        if self.ended_at < self.started_at:
            raise ValueError("ended_at must be on or after started_at")
        return self


class WorkoutSessionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ended_at: datetime | None = None
    actual_elapsed_seconds: int | None = Field(default=None, ge=0)
    completed_intervals: int | None = Field(default=None, ge=0)
    completed_work_intervals: int | None = Field(default=None, ge=0)
    completed_song_blocks: int | None = Field(default=None, ge=0)
    status: SessionStatus | None = None
    feedback: FeedbackWrite | None = None


class PersistedWorkoutSession(BaseModel):
    id: UUID
    workout_id: UUID | None
    started_at: datetime
    ended_at: datetime
    planned_duration_seconds: int
    actual_elapsed_seconds: int
    total_intervals: int
    completed_intervals: int
    completed_work_intervals: int
    completed_song_blocks: int
    status: SessionStatus
    workout_snapshot: GeneratedWorkout
    feedback: FeedbackRead | None
    created_at: datetime
    updated_at: datetime


PageItem = TypeVar("PageItem")


class Page(BaseModel, Generic[PageItem]):
    items: list[PageItem]
    page: int
    page_size: int
    total: int
