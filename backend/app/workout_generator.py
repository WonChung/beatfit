from app.models import (
    Difficulty,
    GenerateWorkoutRequest,
    GeneratedWorkout,
    MuscleGroup,
    Song,
    WorkoutBlock,
    WorkoutInterval,
)


DIFFICULTY_TIMING = {
    Difficulty.beginner: {"work": 35, "rest": 25},
    Difficulty.intermediate: {"work": 45, "rest": 20},
    Difficulty.advanced: {"work": 50, "rest": 15},
}

EXERCISES = {
    MuscleGroup.chest: {
        "warmup": "Arm circles",
        "work": ["Push-ups", "Incline push-ups", "Wide push-ups", "Chest press"],
        "burnout": "Push-up hold",
    },
    MuscleGroup.back: {
        "warmup": "Scapular pulls",
        "work": ["Supermans", "Reverse snow angels", "Bent-over rows", "Lat pulldowns"],
        "burnout": "Superman hold",
    },
    MuscleGroup.legs: {
        "warmup": "Bodyweight squats",
        "work": ["Squats", "Reverse lunges", "Glute bridges", "Calf raises"],
        "burnout": "Wall sit",
    },
    MuscleGroup.shoulders: {
        "warmup": "Shoulder rolls",
        "work": ["Pike push-ups", "Shoulder taps", "Lateral raises", "Overhead press"],
        "burnout": "Overhead hold",
    },
    MuscleGroup.arms: {
        "warmup": "Wrist circles",
        "work": ["Triceps dips", "Biceps curls", "Close-grip push-ups", "Hammer curls"],
        "burnout": "Curl pulse hold",
    },
    MuscleGroup.core: {
        "warmup": "Cat-cow",
        "work": ["Plank", "Dead bugs", "Mountain climbers", "Bicycle crunches"],
        "burnout": "Hollow hold",
    },
    MuscleGroup.full_body: {
        "warmup": "Marching jacks",
        "work": ["Burpees", "Squat to press", "Mountain climbers", "Jumping jacks"],
        "burnout": "High plank hold",
    },
}


def generate_workout(request: GenerateWorkoutRequest) -> GeneratedWorkout:
    return GeneratedWorkout(
        muscle_group=request.muscle_group,
        difficulty=request.difficulty,
        equipment=request.equipment,
        blocks=[
            _generate_block(
                song=song,
                muscle_group=request.muscle_group,
                difficulty=request.difficulty,
            )
            for song in request.songs
        ],
    )


def _generate_block(song: Song, muscle_group: MuscleGroup, difficulty: Difficulty) -> WorkoutBlock:
    duration_seconds = max(1, round(song.duration_ms / 1000))
    intervals = _generate_intervals(duration_seconds, muscle_group, difficulty)

    return WorkoutBlock(
        song=song,
        duration_seconds=duration_seconds,
        intervals=intervals,
    )


def _generate_intervals(
    duration_seconds: int,
    muscle_group: MuscleGroup,
    difficulty: Difficulty,
) -> list[WorkoutInterval]:
    exercises = EXERCISES[muscle_group]

    if duration_seconds <= 2:
        return [
            WorkoutInterval(
                start_seconds=0,
                end_seconds=duration_seconds,
                type="burnout",
                exercise=exercises["burnout"],
            )
        ]

    warmup_seconds = _clamped_percent(duration_seconds)
    burnout_seconds = _clamped_percent(duration_seconds)
    if warmup_seconds + burnout_seconds >= duration_seconds:
        warmup_seconds = max(1, duration_seconds // 3)
        burnout_seconds = max(1, duration_seconds - warmup_seconds)

    intervals = [
        WorkoutInterval(
            start_seconds=0,
            end_seconds=warmup_seconds,
            type="warmup",
            exercise=exercises["warmup"],
        )
    ]

    current = warmup_seconds
    burnout_start = max(current, duration_seconds - burnout_seconds)
    timing = DIFFICULTY_TIMING[difficulty]
    work_exercises = exercises["work"]
    work_index = 0

    while current < burnout_start:
        work_end = min(current + timing["work"], burnout_start)
        if work_end <= current:
            break

        intervals.append(
            WorkoutInterval(
                start_seconds=current,
                end_seconds=work_end,
                type="work",
                exercise=work_exercises[work_index % len(work_exercises)],
            )
        )
        work_index += 1
        current = work_end

        if current >= burnout_start:
            break

        rest_end = min(current + timing["rest"], burnout_start)
        if rest_end <= current:
            break

        intervals.append(
            WorkoutInterval(
                start_seconds=current,
                end_seconds=rest_end,
                type="rest",
                exercise="Rest",
            )
        )
        current = rest_end

    if current < duration_seconds:
        intervals.append(
            WorkoutInterval(
                start_seconds=current,
                end_seconds=duration_seconds,
                type="burnout",
                exercise=exercises["burnout"],
            )
        )
    else:
        intervals[-1].type = "burnout"
        intervals[-1].exercise = exercises["burnout"]
        intervals[-1].end_seconds = duration_seconds

    return intervals


def _clamped_percent(duration_seconds: int) -> int:
    return min(30, max(15, round(duration_seconds * 0.12)))
