import re

from app.domain import (
    Difficulty,
    Equipment,
    Exercise,
    Intensity,
    MovementPattern,
    MuscleGroup,
)


_NAMES: dict[MuscleGroup, dict[Equipment, tuple[str, str, str]]] = {
    MuscleGroup.chest: {
        Equipment.bodyweight: ("Incline push-up", "Push-up", "Tempo wide push-up"),
        Equipment.dumbbells: ("Dumbbell floor press", "Dumbbell squeeze press", "Dumbbell fly"),
        Equipment.gym: ("Machine chest press", "Cable chest press", "Cable fly"),
    },
    MuscleGroup.back: {
        Equipment.bodyweight: ("Prone back extension", "Reverse snow angel", "Superman pull"),
        Equipment.dumbbells: ("Dumbbell row", "Dumbbell pullover", "Renegade row"),
        Equipment.gym: ("Seated cable row", "Lat pulldown", "Assisted pull-up"),
    },
    MuscleGroup.legs: {
        Equipment.bodyweight: ("Bodyweight squat", "Reverse lunge", "Single-leg glute bridge"),
        Equipment.dumbbells: ("Goblet squat", "Dumbbell Romanian deadlift", "Dumbbell split squat"),
        Equipment.gym: ("Leg press", "Cable pull-through", "Hack squat"),
    },
    MuscleGroup.shoulders: {
        Equipment.bodyweight: ("Wall shoulder press", "Shoulder tap", "Pike push-up"),
        Equipment.dumbbells: ("Dumbbell overhead press", "Dumbbell lateral raise", "Arnold press"),
        Equipment.gym: ("Machine shoulder press", "Cable lateral raise", "Cable face pull"),
    },
    MuscleGroup.arms: {
        Equipment.bodyweight: ("Bench triceps dip", "Close-grip push-up", "Bodyweight triceps extension"),
        Equipment.dumbbells: ("Dumbbell curl", "Dumbbell triceps extension", "Hammer curl"),
        Equipment.gym: ("Cable curl", "Rope triceps pushdown", "Preacher curl"),
    },
    MuscleGroup.core: {
        Equipment.bodyweight: ("Dead bug", "Forearm plank", "Bicycle crunch"),
        Equipment.dumbbells: ("Dumbbell dead bug", "Dumbbell Russian twist", "Dumbbell suitcase march"),
        Equipment.gym: ("Cable Pallof press", "Cable crunch", "Captain's chair knee raise"),
    },
    MuscleGroup.full_body: {
        Equipment.bodyweight: ("Marching jack", "Squat thrust", "Burpee"),
        Equipment.dumbbells: ("Dumbbell squat to press", "Dumbbell clean", "Dumbbell devil press"),
        Equipment.gym: ("Sled push", "Cable squat to row", "Rowing sprint"),
    },
}

_PATTERNS: dict[MuscleGroup, tuple[MovementPattern, MovementPattern, MovementPattern]] = {
    MuscleGroup.chest: (MovementPattern.push, MovementPattern.push, MovementPattern.isolation),
    MuscleGroup.back: (MovementPattern.extension, MovementPattern.pull, MovementPattern.pull),
    MuscleGroup.legs: (MovementPattern.squat, MovementPattern.lunge, MovementPattern.hinge),
    MuscleGroup.shoulders: (MovementPattern.push, MovementPattern.isolation, MovementPattern.push),
    MuscleGroup.arms: (MovementPattern.push, MovementPattern.isolation, MovementPattern.pull),
    MuscleGroup.core: (MovementPattern.anti_rotation, MovementPattern.isometric, MovementPattern.rotation),
    MuscleGroup.full_body: (MovementPattern.locomotion, MovementPattern.squat, MovementPattern.hinge),
}

_SECONDARY: dict[MuscleGroup, tuple[MuscleGroup, ...]] = {
    MuscleGroup.chest: (MuscleGroup.shoulders, MuscleGroup.arms),
    MuscleGroup.back: (MuscleGroup.arms, MuscleGroup.core),
    MuscleGroup.legs: (MuscleGroup.core,),
    MuscleGroup.shoulders: (MuscleGroup.arms, MuscleGroup.chest),
    MuscleGroup.arms: (MuscleGroup.chest, MuscleGroup.back),
    MuscleGroup.core: (MuscleGroup.full_body,),
    MuscleGroup.full_body: (MuscleGroup.legs, MuscleGroup.core),
}

_ADVANCED: tuple[tuple[MuscleGroup, Equipment, str, MovementPattern, bool, bool], ...] = (
    (MuscleGroup.chest, Equipment.bodyweight, "Plyometric push-up", MovementPattern.push, False, True),
    (MuscleGroup.back, Equipment.gym, "Weighted pull-up", MovementPattern.pull, False, False),
    (MuscleGroup.legs, Equipment.dumbbells, "Dumbbell jump lunge", MovementPattern.lunge, True, True),
    (MuscleGroup.shoulders, Equipment.bodyweight, "Handstand push-up", MovementPattern.push, False, False),
    (MuscleGroup.arms, Equipment.gym, "Cable curl drop set", MovementPattern.isolation, False, False),
    (MuscleGroup.core, Equipment.bodyweight, "V-up", MovementPattern.flexion, False, False),
    (MuscleGroup.full_body, Equipment.gym, "Battle rope power slam", MovementPattern.locomotion, False, True),
)


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def _seed_catalog() -> tuple[Exercise, ...]:
    exercises: list[Exercise] = []
    minimums = (Difficulty.beginner, Difficulty.beginner, Difficulty.intermediate)
    intensities = (Intensity.low, Intensity.medium, Intensity.high)

    for muscle_group, equipment_groups in _NAMES.items():
        for equipment, names in equipment_groups.items():
            for index, name in enumerate(names):
                high_impact = name in {"Burpee", "Dumbbell devil press", "Rowing sprint"}
                exercises.append(
                    Exercise(
                        id=f"{muscle_group}-{equipment}-{_slug(name)}",
                        name=name,
                        primary_muscle_group=muscle_group,
                        secondary_muscle_groups=_SECONDARY[muscle_group],
                        equipment=(equipment,),
                        minimum_difficulty=minimums[index],
                        movement_pattern=_PATTERNS[muscle_group][index],
                        intensity=intensities[index],
                        instructions=f"Perform {name.lower()} with controlled form and steady breathing.",
                        unilateral="single-leg" in name.lower() or "lunge" in name.lower(),
                        high_impact=high_impact,
                        contraindication_notes=(
                            "Avoid or substitute if jumping causes joint pain." if high_impact else None
                        ),
                    )
                )

    for muscle_group, equipment, name, pattern, unilateral, high_impact in _ADVANCED:
        exercises.append(
            Exercise(
                id=f"{muscle_group}-{equipment}-{_slug(name)}",
                name=name,
                primary_muscle_group=muscle_group,
                secondary_muscle_groups=_SECONDARY[muscle_group],
                equipment=(equipment,),
                minimum_difficulty=Difficulty.advanced,
                movement_pattern=pattern,
                intensity=Intensity.high,
                instructions=f"Perform {name.lower()} only with stable, technically sound repetitions.",
                unilateral=unilateral,
                high_impact=high_impact,
                contraindication_notes=(
                    "Advanced movement; substitute when impact, joint loading, or balance is unsafe."
                ),
            )
        )

    return tuple(exercises)


EXERCISE_CATALOG = _seed_catalog()

_DIFFICULTY_RANK = {
    Difficulty.beginner: 0,
    Difficulty.intermediate: 1,
    Difficulty.advanced: 2,
}


def filter_exercises(
    *,
    muscle_group: MuscleGroup | None = None,
    equipment: Equipment | None = None,
    difficulty: Difficulty | None = None,
    include_secondary: bool = True,
) -> list[Exercise]:
    exercises = list(EXERCISE_CATALOG)
    if muscle_group is not None:
        exercises = [
            exercise
            for exercise in exercises
            if exercise.primary_muscle_group == muscle_group
            or (include_secondary and muscle_group in exercise.secondary_muscle_groups)
        ]
    if equipment is not None:
        exercises = [exercise for exercise in exercises if equipment in exercise.equipment]
    if difficulty is not None:
        exercises = [
            exercise
            for exercise in exercises
            if _DIFFICULTY_RANK[exercise.minimum_difficulty] <= _DIFFICULTY_RANK[difficulty]
        ]
    return exercises
