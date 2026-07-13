"""Deterministic, explainable rules for adapting generated workouts."""

from collections import Counter
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.api_models import (
    GenerateWorkoutRequest,
    PersonalizationExplanation,
    UserPreferencesRead,
    UserPreferencesUpdate,
)
from app.db_models import SessionFeedback, User, UserPreference, WorkoutSession
from app.domain import Difficulty, FeedbackRating, WorkRestPreference
from app.exercise_catalog import EXERCISE_CATALOG
from app.generator_service import GenerationPersonalization


class PersonalizationValidationError(Exception):
    pass


class PersonalizationUnavailableError(Exception):
    pass


_DIFFICULTIES = (Difficulty.beginner, Difficulty.intermediate, Difficulty.advanced)
_CATALOG_IDS = frozenset(exercise.id for exercise in EXERCISE_CATALOG)


def get_preferences(database: Session, user: User) -> UserPreferencesRead:
    return _serialize_preferences(_get_or_create_preferences(database, user))


def update_preferences(
    database: Session,
    user: User,
    payload: UserPreferencesUpdate,
) -> UserPreferencesRead:
    preference = _get_or_create_preferences(database, user)
    updates = payload.model_dump(exclude_unset=True)
    for field_name in ("avoided_exercise_ids", "favorite_exercise_ids"):
        if field_name in updates and updates[field_name] is not None:
            updates[field_name] = _validate_and_deduplicate_exercise_ids(
                updates[field_name]
            )
    if "available_equipment" in updates and updates["available_equipment"] is not None:
        updates["available_equipment"] = list(
            dict.fromkeys(item.value for item in updates["available_equipment"])
        )
    for field_name in (
        "default_difficulty",
        "preferred_goal",
        "work_rest_preference",
    ):
        if field_name in updates and updates[field_name] is not None:
            updates[field_name] = updates[field_name].value
    for field_name, value in updates.items():
        if value is not None:
            setattr(preference, field_name, value)
    _commit(database)
    database.refresh(preference)
    return _serialize_preferences(preference)


def reset_personalization(database: Session, user: User) -> UserPreferencesRead:
    preference = _get_or_create_preferences(database, user)
    preference.history_reset_at = datetime.now(UTC)
    _commit(database)
    database.refresh(preference)
    return _serialize_preferences(preference)


def build_generation_personalization(
    database: Session,
    user: User,
    request: GenerateWorkoutRequest,
) -> GenerationPersonalization:
    preference = _get_or_create_preferences(database, user)
    requested_equipment = {item.value for item in request.equipment}
    unavailable_equipment = requested_equipment.difference(preference.available_equipment)
    if unavailable_equipment:
        unavailable = ", ".join(sorted(unavailable_equipment))
        raise PersonalizationValidationError(
            f"Requested equipment is not available in your preferences: {unavailable}."
        )

    ratings = _recent_matching_ratings(database, user, request, preference)
    signal = _feedback_signal(ratings)
    effective_difficulty = request.difficulty
    work_delta = 0
    rest_delta = 0
    adjustments: list[str] = []

    if signal == FeedbackRating.too_easy:
        effective_difficulty = _shift_difficulty(request.difficulty, 1)
        work_delta += 5
        rest_delta -= 3
        if effective_difficulty != request.difficulty:
            adjustments.append(
                f"Difficulty increased from {request.difficulty.value} "
                f"to {effective_difficulty.value}."
            )
        adjustments.extend(
            ["Work intervals increased by 5 seconds.", "Rest intervals reduced by 3 seconds."]
        )
    elif signal == FeedbackRating.too_hard:
        effective_difficulty = _shift_difficulty(request.difficulty, -1)
        work_delta -= 5
        rest_delta += 5
        if effective_difficulty != request.difficulty:
            adjustments.append(
                f"Difficulty reduced from {request.difficulty.value} "
                f"to {effective_difficulty.value}."
            )
        adjustments.extend(
            ["Work intervals reduced by 5 seconds.", "Rest intervals increased by 5 seconds."]
        )

    work_rest_preference = WorkRestPreference(preference.work_rest_preference)
    if work_rest_preference == WorkRestPreference.more_work:
        work_delta += 5
        rest_delta -= 3
        adjustments.append(
            "Your more-work preference added 5 seconds of work and removed 3 seconds of rest."
        )
    elif work_rest_preference == WorkRestPreference.more_rest:
        work_delta -= 5
        rest_delta += 5
        adjustments.append(
            "Your more-rest preference removed 5 seconds of work and added 5 seconds of rest."
        )

    avoided_ids = frozenset(preference.avoided_exercise_ids)
    favorite_ids = frozenset(preference.favorite_exercise_ids).difference(avoided_ids)
    if avoided_ids:
        adjustments.append("Avoided exercises were excluded.")
    if favorite_ids:
        adjustments.append("Compatible favorite exercises were preferred.")
    if not preference.high_impact_allowed:
        adjustments.append("High-impact movements were excluded.")

    explanation = PersonalizationExplanation(
        personalized=bool(adjustments),
        summary=_explanation_summary(
            signal=signal,
            ratings=ratings,
            work_rest_preference=work_rest_preference,
            has_other_adjustments=bool(
                avoided_ids or favorite_ids or not preference.high_impact_allowed
            ),
        ),
        feedback_signal=signal,
        history_sessions_considered=len(ratings),
        adjustments=adjustments,
    )
    return GenerationPersonalization(
        difficulty=effective_difficulty,
        prefer_exact_difficulty=(
            signal == FeedbackRating.too_easy
            and effective_difficulty != request.difficulty
        ),
        work_seconds_delta=work_delta,
        rest_seconds_delta=rest_delta,
        avoided_exercise_ids=avoided_ids,
        favorite_exercise_ids=favorite_ids,
        high_impact_allowed=preference.high_impact_allowed,
        explanation=explanation,
    )


def _get_or_create_preferences(database: Session, user: User) -> UserPreference:
    preference = database.scalar(
        select(UserPreference).where(UserPreference.user_id == user.id)
    )
    if preference is not None:
        return preference
    preference = UserPreference(user_id=user.id)
    database.add(preference)
    _commit(database)
    database.refresh(preference)
    return preference


def _recent_matching_ratings(
    database: Session,
    user: User,
    request: GenerateWorkoutRequest,
    preference: UserPreference,
) -> list[FeedbackRating]:
    statement = (
        select(WorkoutSession, SessionFeedback.rating)
        .join(SessionFeedback, SessionFeedback.session_id == WorkoutSession.id)
        .where(WorkoutSession.user_id == user.id)
        .order_by(WorkoutSession.ended_at.desc(), WorkoutSession.id.desc())
    )
    if preference.history_reset_at is not None:
        statement = statement.where(
            WorkoutSession.ended_at > preference.history_reset_at
        )

    ratings: list[FeedbackRating] = []
    for session, raw_rating in database.execute(statement):
        snapshot = session.workout_snapshot
        if not isinstance(snapshot, dict):
            continue
        if snapshot.get("muscle_group") != request.muscle_group.value:
            continue
        if snapshot.get("goal") != request.goal.value:
            continue
        try:
            ratings.append(FeedbackRating(raw_rating))
        except ValueError:
            continue
        if len(ratings) == 3:
            break
    return ratings


def _feedback_signal(ratings: list[FeedbackRating]) -> FeedbackRating | None:
    counts = Counter(ratings)
    if counts[FeedbackRating.too_easy] >= 2 and counts[FeedbackRating.too_hard] == 0:
        return FeedbackRating.too_easy
    if counts[FeedbackRating.too_hard] >= 2 and counts[FeedbackRating.too_easy] == 0:
        return FeedbackRating.too_hard
    if counts[FeedbackRating.about_right] >= 2:
        return FeedbackRating.about_right
    return None


def _shift_difficulty(difficulty: Difficulty, steps: int) -> Difficulty:
    current_index = _DIFFICULTIES.index(difficulty)
    next_index = min(max(current_index + steps, 0), len(_DIFFICULTIES) - 1)
    return _DIFFICULTIES[next_index]


def _explanation_summary(
    *,
    signal: FeedbackRating | None,
    ratings: list[FeedbackRating],
    work_rest_preference: WorkRestPreference,
    has_other_adjustments: bool,
) -> str:
    parts: list[str] = []
    if signal == FeedbackRating.too_easy:
        parts.append(
            "Workout intensity increased because two recent matching workouts were "
            "rated too easy."
        )
    elif signal == FeedbackRating.too_hard:
        parts.append("Rest increased because two recent matching workouts were rated too hard.")
    elif signal == FeedbackRating.about_right:
        parts.append(
            "Recent matching workouts were rated about right, so no feedback-driven "
            "change was made."
        )
    elif len(ratings) < 2:
        parts.append(
            "No feedback adjustment was made because fewer than two matching ratings "
            "are available."
        )
    else:
        parts.append("No feedback adjustment was made because recent matching ratings conflict.")

    if work_rest_preference != WorkRestPreference.balanced:
        parts.append("Timing was adjusted using your saved work/rest preference.")
    if has_other_adjustments:
        parts.append("Your saved exercise and impact preferences were applied.")
    return " ".join(parts)


def _validate_and_deduplicate_exercise_ids(exercise_ids: list[str]) -> list[str]:
    cleaned = list(dict.fromkeys(exercise_id.strip() for exercise_id in exercise_ids))
    unknown = sorted(set(cleaned).difference(_CATALOG_IDS))
    if "" in cleaned or unknown:
        invalid = unknown or ["empty exercise ID"]
        raise PersonalizationValidationError(
            f"Unknown exercise preference: {', '.join(invalid)}."
        )
    return cleaned


def _serialize_preferences(preference: UserPreference) -> UserPreferencesRead:
    return UserPreferencesRead(
        default_difficulty=preference.default_difficulty,
        available_equipment=preference.available_equipment,
        preferred_goal=preference.preferred_goal,
        avoided_exercise_ids=preference.avoided_exercise_ids,
        favorite_exercise_ids=preference.favorite_exercise_ids,
        high_impact_allowed=preference.high_impact_allowed,
        work_rest_preference=preference.work_rest_preference,
        history_reset_at=preference.history_reset_at,
        created_at=preference.created_at,
        updated_at=preference.updated_at,
    )


def _commit(database: Session) -> None:
    try:
        database.commit()
    except IntegrityError as error:
        database.rollback()
        raise PersonalizationUnavailableError(
            "The preference update conflicted with another request."
        ) from error
    except SQLAlchemyError as error:
        database.rollback()
        raise PersonalizationUnavailableError(
            "The personalization data could not be accessed."
        ) from error
