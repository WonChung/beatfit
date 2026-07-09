from enum import StrEnum

from pydantic import BaseModel, Field


class MuscleGroup(StrEnum):
    chest = "chest"
    back = "back"
    legs = "legs"
    shoulders = "shoulders"
    arms = "arms"
    core = "core"
    full_body = "full_body"


class Difficulty(StrEnum):
    beginner = "beginner"
    intermediate = "intermediate"
    advanced = "advanced"


class Song(BaseModel):
    title: str = Field(min_length=1)
    artist: str = Field(min_length=1)
    duration_ms: int = Field(gt=0)


class GenerateWorkoutRequest(BaseModel):
    muscle_group: MuscleGroup
    difficulty: Difficulty
    equipment: list[str] = Field(min_length=1)
    songs: list[Song] = Field(min_length=1)


class WorkoutInterval(BaseModel):
    start_seconds: int
    end_seconds: int
    type: str
    exercise: str


class WorkoutBlock(BaseModel):
    song: Song
    duration_seconds: int
    intervals: list[WorkoutInterval]


class GeneratedWorkout(BaseModel):
    muscle_group: MuscleGroup
    difficulty: Difficulty
    equipment: list[str]
    blocks: list[WorkoutBlock]
