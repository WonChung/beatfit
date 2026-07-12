from collections import deque
from dataclasses import dataclass, field
import random

from app.api_models import (
    GenerateWorkoutRequest,
    GeneratedWorkout,
    Song,
    WorkoutBlock,
    WorkoutInterval,
)
from app.domain import Difficulty, Exercise, Intensity, MovementPattern, WorkoutGoal
from app.exercise_catalog import filter_exercises


_DEFAULT_TIMING = {
    WorkoutGoal.strength: {"work": 50, "rest": 25},
    WorkoutGoal.pump: {"work": 45, "rest": 15},
    WorkoutGoal.endurance: {"work": 45, "rest": 20},
    WorkoutGoal.cardio: {"work": 35, "rest": 10},
}

_DIFFICULTY_ADJUSTMENT = {
    Difficulty.beginner: {"work": -10, "rest": 5},
    Difficulty.intermediate: {"work": 0, "rest": 0},
    Difficulty.advanced: {"work": 5, "rest": -5},
}

_GOAL_INTENSITY = {
    WorkoutGoal.strength: Intensity.high,
    WorkoutGoal.pump: Intensity.medium,
    WorkoutGoal.endurance: Intensity.medium,
    WorkoutGoal.cardio: Intensity.high,
}


@dataclass(slots=True)
class SelectionContext:
    recent_ids: deque[str] = field(default_factory=lambda: deque(maxlen=5))
    last_exercise_id: str | None = None
    last_movement_pattern: MovementPattern | None = None
    last_was_high_impact: bool = False

    def record(self, exercise: Exercise) -> None:
        self.recent_ids.append(exercise.id)
        self.last_exercise_id = exercise.id
        self.last_movement_pattern = exercise.movement_pattern
        self.last_was_high_impact = exercise.high_impact


def generate_workout(request: GenerateWorkoutRequest) -> GeneratedWorkout:
    rng = random.Random(request.random_seed)
    selected_equipment = set(request.equipment)
    candidates = [
        exercise
        for exercise in filter_exercises(
            muscle_group=request.muscle_group,
            difficulty=request.difficulty,
            include_secondary=False,
        )
        if selected_equipment.intersection(exercise.equipment)
    ]
    if not candidates:
        raise ValueError("No exercises match the requested workout configuration.")

    context = SelectionContext()
    blocks = [
        _generate_block(
            song=song,
            candidates=candidates,
            difficulty=request.difficulty,
            goal=request.goal,
            context=context,
            rng=rng,
        )
        for song in request.songs
    ]
    return GeneratedWorkout(
        muscle_group=request.muscle_group,
        difficulty=request.difficulty,
        equipment=request.equipment,
        goal=request.goal,
        blocks=blocks,
    )


def _generate_block(
    *,
    song: Song,
    candidates: list[Exercise],
    difficulty: Difficulty,
    goal: WorkoutGoal,
    context: SelectionContext,
    rng: random.Random,
) -> WorkoutBlock:
    duration_seconds = max(1, round(song.duration_ms / 1000))
    intervals = _generate_intervals(
        duration_seconds=duration_seconds,
        candidates=candidates,
        difficulty=difficulty,
        goal=goal,
        context=context,
        rng=rng,
    )
    return WorkoutBlock(song=song, duration_seconds=duration_seconds, intervals=intervals)


def _generate_intervals(
    *,
    duration_seconds: int,
    candidates: list[Exercise],
    difficulty: Difficulty,
    goal: WorkoutGoal,
    context: SelectionContext,
    rng: random.Random,
) -> list[WorkoutInterval]:
    if duration_seconds <= 20:
        exercise = _choose_exercise(candidates, context, rng, _GOAL_INTENSITY[goal])
        return [_exercise_interval(0, duration_seconds, "work", exercise)]

    warmup_seconds = min(30, max(8, round(duration_seconds * 0.10)))
    burnout_seconds = min(30, max(8, round(duration_seconds * 0.10)))
    main_end = duration_seconds - burnout_seconds
    warmup = _choose_exercise(candidates, context, rng, Intensity.low)
    intervals = [_exercise_interval(0, warmup_seconds, "warmup", warmup)]
    current = warmup_seconds
    timing = _timing(difficulty, goal)

    while current < main_end:
        exercise = _choose_exercise(candidates, context, rng, _GOAL_INTENSITY[goal])
        work_end = min(current + timing["work"], main_end)
        intervals.append(_exercise_interval(current, work_end, "work", exercise))
        current = work_end
        if current >= main_end:
            break

        rest_end = min(current + timing["rest"], main_end)
        intervals.append(
            WorkoutInterval(
                start_seconds=current,
                end_seconds=rest_end,
                type="rest",
                exercise="Rest",
                exercise_id=None,
            )
        )
        current = rest_end

    finisher = _choose_exercise(candidates, context, rng, Intensity.high)
    intervals.append(_exercise_interval(main_end, duration_seconds, "burnout", finisher))
    return intervals


def _timing(difficulty: Difficulty, goal: WorkoutGoal) -> dict[str, int]:
    base = _DEFAULT_TIMING[goal]
    adjustment = _DIFFICULTY_ADJUSTMENT[difficulty]
    return {
        "work": max(10, base["work"] + adjustment["work"]),
        "rest": max(5, base["rest"] + adjustment["rest"]),
    }


def _choose_exercise(
    candidates: list[Exercise],
    context: SelectionContext,
    rng: random.Random,
    preferred_intensity: Intensity,
) -> Exercise:
    pool = [exercise for exercise in candidates if exercise.intensity == preferred_intensity]
    if not pool:
        pool = list(candidates)

    if context.last_was_high_impact:
        lower_impact = [exercise for exercise in pool if not exercise.high_impact]
        if not lower_impact:
            lower_impact = [exercise for exercise in candidates if not exercise.high_impact]
        if lower_impact:
            pool = lower_impact

    if context.last_exercise_id and len(pool) > 1:
        alternatives = [exercise for exercise in pool if exercise.id != context.last_exercise_id]
        if alternatives:
            pool = alternatives

    if context.last_movement_pattern is not None:
        different_patterns = [
            exercise for exercise in pool if exercise.movement_pattern != context.last_movement_pattern
        ]
        if different_patterns:
            pool = different_patterns

    not_recent = [exercise for exercise in pool if exercise.id not in context.recent_ids]
    if not_recent:
        pool = not_recent

    exercise = rng.choice(sorted(pool, key=lambda item: item.id))
    context.record(exercise)
    return exercise


def _exercise_interval(
    start_seconds: int,
    end_seconds: int,
    interval_type: str,
    exercise: Exercise,
) -> WorkoutInterval:
    return WorkoutInterval(
        start_seconds=start_seconds,
        end_seconds=end_seconds,
        type=interval_type,
        exercise=exercise.name,
        exercise_id=exercise.id,
    )
