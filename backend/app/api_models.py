from datetime import datetime
from typing import Annotated, Generic, Literal, TypeVar
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
    WorkRestPreference,
)

MAX_SONG_COUNT = 50
MAX_EQUIPMENT_COUNT = 3
MAX_SONG_DURATION_MS = 60 * 60 * 1_000
MAX_WORKOUT_DURATION_MS = 4 * 60 * 60 * 1_000
MAX_SONG_TITLE_LENGTH = 240
MAX_SONG_ARTIST_LENGTH = 240
MAX_ARTWORK_URL_LENGTH = 2_048
MAX_PROVIDER_ID_LENGTH = 256
MAX_STOREFRONT_LENGTH = 16
MAX_INTERVAL_TYPE_LENGTH = 32
MAX_EXERCISE_NAME_LENGTH = 240
MAX_EXERCISE_ID_LENGTH = 180
MAX_PREFERENCE_EXERCISE_ID_COUNT = 100
MIN_RANDOM_SEED = -(2**31)
MAX_RANDOM_SEED = 2**31 - 1
MAX_BLOCK_DURATION_SECONDS = max(1, round(MAX_SONG_DURATION_MS / 1_000))
MAX_PERSISTED_WORKOUT_DURATION_SECONDS = (MAX_WORKOUT_DURATION_MS // 1_000) + MAX_SONG_COUNT
MAX_INTERVALS_PER_BLOCK = 1_024
MAX_WORKOUT_INTERVAL_COUNT = 4_096
MAX_SESSION_ELAPSED_SECONDS = MAX_RANDOM_SEED

ExerciseId = Annotated[
    str,
    Field(min_length=1, max_length=MAX_EXERCISE_ID_LENGTH),
]


class AppleMusicProviderIdentifier(BaseModel):
    provider: Literal["apple_music"]
    catalog_id: str = Field(min_length=1, max_length=MAX_PROVIDER_ID_LENGTH)
    library_id: str | None = Field(
        default=None,
        min_length=1,
        max_length=MAX_PROVIDER_ID_LENGTH,
    )
    storefront: str = Field(min_length=1, max_length=MAX_STOREFRONT_LENGTH)


class SpotifyProviderIdentifier(BaseModel):
    provider: Literal["spotify"]
    catalog_id: str = Field(min_length=1, max_length=MAX_PROVIDER_ID_LENGTH)


ProviderIdentifier = Annotated[
    AppleMusicProviderIdentifier | SpotifyProviderIdentifier,
    Field(discriminator="provider"),
]


class Song(BaseModel):
    title: str = Field(min_length=1, max_length=MAX_SONG_TITLE_LENGTH)
    artist: str = Field(min_length=1, max_length=MAX_SONG_ARTIST_LENGTH)
    duration_ms: int = Field(ge=1, le=MAX_SONG_DURATION_MS)
    artwork_url: str | None = Field(default=None, max_length=MAX_ARTWORK_URL_LENGTH)
    provider_identifier: ProviderIdentifier | None = None


class AppleMusicTrack(BaseModel):
    id: str
    title: str
    artist: str
    duration_ms: int | None
    artwork_url: str | None = None
    is_playable: bool = True
    provider_identifier: AppleMusicProviderIdentifier


class AppleDeveloperToken(BaseModel):
    token: str
    expires_at: int


class GenerateWorkoutRequest(BaseModel):
    muscle_group: MuscleGroup
    difficulty: Difficulty
    equipment: list[Equipment] = Field(
        min_length=1,
        max_length=MAX_EQUIPMENT_COUNT,
    )
    songs: list[Song] = Field(min_length=1, max_length=MAX_SONG_COUNT)
    goal: WorkoutGoal = WorkoutGoal.endurance
    random_seed: int | None = Field(
        default=None,
        ge=MIN_RANDOM_SEED,
        le=MAX_RANDOM_SEED,
    )

    @model_validator(mode="after")
    def validate_total_duration(self) -> "GenerateWorkoutRequest":
        total_duration_ms = sum(song.duration_ms for song in self.songs)
        if total_duration_ms > MAX_WORKOUT_DURATION_MS:
            raise ValueError(
                f"Combined song duration must not exceed {MAX_WORKOUT_DURATION_MS} ms."
            )
        return self


class WorkoutInterval(BaseModel):
    start_seconds: int = Field(ge=0, le=MAX_BLOCK_DURATION_SECONDS)
    end_seconds: int = Field(ge=1, le=MAX_BLOCK_DURATION_SECONDS)
    type: str = Field(min_length=1, max_length=MAX_INTERVAL_TYPE_LENGTH)
    exercise: str = Field(min_length=1, max_length=MAX_EXERCISE_NAME_LENGTH)
    exercise_id: str | None = Field(
        default=None,
        min_length=1,
        max_length=MAX_EXERCISE_ID_LENGTH,
    )

    @model_validator(mode="after")
    def validate_positive_duration(self) -> "WorkoutInterval":
        if self.end_seconds <= self.start_seconds:
            raise ValueError("end_seconds must be greater than start_seconds")
        return self


class WorkoutBlock(BaseModel):
    song: Song
    duration_seconds: int = Field(ge=1, le=MAX_BLOCK_DURATION_SECONDS)
    intervals: list[WorkoutInterval] = Field(
        min_length=1,
        max_length=MAX_INTERVALS_PER_BLOCK,
    )


class PersonalizationExplanation(BaseModel):
    personalized: bool = False
    summary: str = "No personalization was applied."
    feedback_signal: FeedbackRating | None = None
    history_sessions_considered: int = 0
    adjustments: list[str] = Field(default_factory=list)


def _neutral_personalization() -> PersonalizationExplanation:
    return PersonalizationExplanation()


class GeneratedWorkout(BaseModel):
    workout_id: UUID | None = None
    muscle_group: MuscleGroup
    difficulty: Difficulty
    equipment: list[Equipment]
    goal: WorkoutGoal
    blocks: list[WorkoutBlock]
    personalization: PersonalizationExplanation = Field(default_factory=_neutral_personalization)


class UserPreferencesRead(BaseModel):
    default_difficulty: Difficulty
    available_equipment: list[Equipment]
    preferred_goal: WorkoutGoal
    avoided_exercise_ids: list[str]
    favorite_exercise_ids: list[str]
    high_impact_allowed: bool
    work_rest_preference: WorkRestPreference
    history_reset_at: datetime | None
    created_at: datetime
    updated_at: datetime


class UserPreferencesUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    default_difficulty: Difficulty | None = None
    available_equipment: list[Equipment] | None = Field(
        default=None,
        min_length=1,
        max_length=MAX_EQUIPMENT_COUNT,
    )
    preferred_goal: WorkoutGoal | None = None
    avoided_exercise_ids: list[ExerciseId] | None = Field(
        default=None,
        max_length=MAX_PREFERENCE_EXERCISE_ID_COUNT,
    )
    favorite_exercise_ids: list[ExerciseId] | None = Field(
        default=None,
        max_length=MAX_PREFERENCE_EXERCISE_ID_COUNT,
    )
    high_impact_allowed: bool | None = None
    work_rest_preference: WorkRestPreference | None = None


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
    equipment: list[Equipment] = Field(
        min_length=1,
        max_length=MAX_EQUIPMENT_COUNT,
    )
    goal: WorkoutGoal = WorkoutGoal.endurance
    random_seed: int | None = Field(
        default=None,
        ge=MIN_RANDOM_SEED,
        le=MAX_RANDOM_SEED,
    )
    blocks: list[WorkoutBlock] = Field(min_length=1, max_length=MAX_SONG_COUNT)
    saved_name: str | None = Field(default=None, min_length=1, max_length=160)
    is_favorite: bool = False

    @model_validator(mode="after")
    def validate_aggregate_bounds(self) -> "WorkoutCreate":
        total_song_duration_ms = sum(block.song.duration_ms for block in self.blocks)
        if total_song_duration_ms > MAX_WORKOUT_DURATION_MS:
            raise ValueError(
                f"Combined block song duration must not exceed {MAX_WORKOUT_DURATION_MS} ms."
            )

        total_block_duration_seconds = sum(block.duration_seconds for block in self.blocks)
        if total_block_duration_seconds > MAX_PERSISTED_WORKOUT_DURATION_SECONDS:
            raise ValueError("Combined block duration exceeds the supported workout duration.")

        total_intervals = sum(len(block.intervals) for block in self.blocks)
        if total_intervals > MAX_WORKOUT_INTERVAL_COUNT:
            raise ValueError(
                f"Workout must not contain more than {MAX_WORKOUT_INTERVAL_COUNT} intervals."
            )
        return self


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
    actual_elapsed_seconds: int = Field(ge=0, le=MAX_SESSION_ELAPSED_SECONDS)
    completed_intervals: int = Field(ge=0, le=MAX_WORKOUT_INTERVAL_COUNT)
    completed_work_intervals: int = Field(ge=0, le=MAX_WORKOUT_INTERVAL_COUNT)
    completed_song_blocks: int = Field(ge=0, le=MAX_SONG_COUNT)
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
    actual_elapsed_seconds: int | None = Field(
        default=None,
        ge=0,
        le=MAX_SESSION_ELAPSED_SECONDS,
    )
    completed_intervals: int | None = Field(
        default=None,
        ge=0,
        le=MAX_WORKOUT_INTERVAL_COUNT,
    )
    completed_work_intervals: int | None = Field(
        default=None,
        ge=0,
        le=MAX_WORKOUT_INTERVAL_COUNT,
    )
    completed_song_blocks: int | None = Field(
        default=None,
        ge=0,
        le=MAX_SONG_COUNT,
    )
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
