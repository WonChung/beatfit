from dataclasses import dataclass
from enum import StrEnum


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


class Equipment(StrEnum):
    bodyweight = "bodyweight"
    dumbbells = "dumbbells"
    gym = "gym"


class WorkoutGoal(StrEnum):
    strength = "strength"
    pump = "pump"
    endurance = "endurance"
    cardio = "cardio"


class MovementPattern(StrEnum):
    push = "push"
    pull = "pull"
    squat = "squat"
    hinge = "hinge"
    lunge = "lunge"
    carry = "carry"
    rotation = "rotation"
    anti_rotation = "anti_rotation"
    flexion = "flexion"
    extension = "extension"
    isolation = "isolation"
    locomotion = "locomotion"
    mobility = "mobility"
    isometric = "isometric"


class Intensity(StrEnum):
    low = "low"
    medium = "medium"
    high = "high"


class SessionStatus(StrEnum):
    completed = "completed"
    ended_early = "ended_early"


class FeedbackRating(StrEnum):
    too_easy = "too_easy"
    about_right = "about_right"
    too_hard = "too_hard"


@dataclass(frozen=True, slots=True)
class Exercise:
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
    contraindication_notes: str | None = None
