import uuid

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.api_models import (
    FeedbackRead,
    GeneratedWorkout,
    Page,
    PersistedWorkout,
    PersistedWorkoutSession,
    Song,
    WorkoutBlock as WorkoutBlockSchema,
    WorkoutCreate,
    WorkoutInterval as WorkoutIntervalSchema,
    WorkoutSessionCreate,
    WorkoutSessionUpdate,
)
from app.db_models import (
    SavedWorkout,
    SessionFeedback,
    Workout,
    WorkoutBlock,
    WorkoutInterval,
    WorkoutSession,
    User,
)


class PersistenceNotFoundError(Exception):
    pass


class PersistenceConflictError(Exception):
    pass


class PersistenceValidationError(Exception):
    pass


class PersistenceUnavailableError(Exception):
    pass


def create_workout(database: Session, user: User, payload: WorkoutCreate) -> PersistedWorkout:
    _validate_blocks(payload.blocks)
    workout = Workout(
        user_id=user.id,
        name=payload.name,
        muscle_group=payload.muscle_group.value,
        difficulty=payload.difficulty.value,
        equipment=[item.value for item in payload.equipment],
        goal=payload.goal.value,
        random_seed=payload.random_seed,
    )
    for block_position, block_payload in enumerate(payload.blocks):
        block = WorkoutBlock(
            position=block_position,
            song_title=block_payload.song.title,
            song_artist=block_payload.song.artist,
            song_duration_ms=block_payload.song.duration_ms,
            duration_seconds=block_payload.duration_seconds,
        )
        block.intervals = [
            WorkoutInterval(
                position=interval_position,
                start_seconds=interval.start_seconds,
                end_seconds=interval.end_seconds,
                interval_type=interval.type,
                exercise_name=interval.exercise,
                exercise_catalog_id=interval.exercise_id,
            )
            for interval_position, interval in enumerate(block_payload.intervals)
        ]
        workout.blocks.append(block)
    database.add(workout)
    if payload.saved_name:
        workout.saved_entries.append(
            SavedWorkout(
                user_id=user.id,
                name=payload.saved_name.strip(),
                is_favorite=payload.is_favorite,
            )
        )
    _commit(database)
    database.refresh(workout)
    return serialize_workout(workout)


def list_workouts(database: Session, user: User, page: int, page_size: int) -> Page[PersistedWorkout]:
    total = database.scalar(
        select(func.count()).select_from(Workout).where(Workout.user_id == user.id)
    ) or 0
    workouts = database.scalars(
        select(Workout)
        .where(Workout.user_id == user.id)
        .options(selectinload(Workout.blocks).selectinload(WorkoutBlock.intervals))
        .order_by(Workout.created_at.desc(), Workout.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return Page(
        items=[serialize_workout(workout) for workout in workouts],
        page=page,
        page_size=page_size,
        total=total,
    )


def get_workout(database: Session, user: User, workout_id: uuid.UUID) -> PersistedWorkout:
    workout = _owned_workout(database, user, workout_id)
    return serialize_workout(workout)


def delete_workout(database: Session, user: User, workout_id: uuid.UUID) -> None:
    workout = _owned_workout(database, user, workout_id)
    database.delete(workout)
    _commit(database)


def create_session(
    database: Session, user: User, payload: WorkoutSessionCreate
) -> PersistedWorkoutSession:
    workout = _owned_workout(database, user, payload.workout_id)
    total_intervals = sum(len(block.intervals) for block in workout.blocks)
    _validate_session_counts(
        completed_intervals=payload.completed_intervals,
        completed_work_intervals=payload.completed_work_intervals,
        completed_song_blocks=payload.completed_song_blocks,
        total_intervals=total_intervals,
        total_blocks=len(workout.blocks),
    )
    snapshot = _generated_workout(workout)
    session = WorkoutSession(
        user_id=user.id,
        workout_id=workout.id,
        started_at=payload.started_at,
        ended_at=payload.ended_at,
        planned_duration_seconds=sum(block.duration_seconds for block in workout.blocks),
        actual_elapsed_seconds=payload.actual_elapsed_seconds,
        total_intervals=total_intervals,
        completed_intervals=payload.completed_intervals,
        completed_work_intervals=payload.completed_work_intervals,
        completed_song_blocks=payload.completed_song_blocks,
        status=payload.status.value,
        workout_snapshot=snapshot.model_dump(mode="json"),
    )
    if payload.feedback:
        session.feedback = SessionFeedback(
            rating=payload.feedback.rating.value,
            notes=payload.feedback.notes,
        )
    database.add(session)
    _commit(database)
    database.refresh(session)
    return serialize_session(session)


def update_session(
    database: Session,
    user: User,
    session_id: uuid.UUID,
    payload: WorkoutSessionUpdate,
) -> PersistedWorkoutSession:
    session = _owned_session(database, user, session_id)
    updates = payload.model_dump(exclude_unset=True, exclude={"feedback"})
    if "status" in updates:
        updates["status"] = updates["status"].value
    for field_name, value in updates.items():
        setattr(session, field_name, value)
    if session.ended_at < session.started_at:
        raise PersistenceValidationError("ended_at must be on or after started_at")
    _validate_session_counts(
        completed_intervals=session.completed_intervals,
        completed_work_intervals=session.completed_work_intervals,
        completed_song_blocks=session.completed_song_blocks,
        total_intervals=session.total_intervals,
        total_blocks=len(session.workout_snapshot.get("blocks", [])),
    )
    if "feedback" in payload.model_fields_set and payload.feedback is not None:
        if session.feedback is None:
            session.feedback = SessionFeedback(
                rating=payload.feedback.rating.value,
                notes=payload.feedback.notes,
            )
        else:
            session.feedback.rating = payload.feedback.rating.value
            session.feedback.notes = payload.feedback.notes
    _commit(database)
    database.refresh(session)
    return serialize_session(session)


def list_sessions(
    database: Session, user: User, page: int, page_size: int
) -> Page[PersistedWorkoutSession]:
    total = database.scalar(
        select(func.count()).select_from(WorkoutSession).where(WorkoutSession.user_id == user.id)
    ) or 0
    sessions = database.scalars(
        select(WorkoutSession)
        .where(WorkoutSession.user_id == user.id)
        .options(selectinload(WorkoutSession.feedback))
        .order_by(WorkoutSession.ended_at.desc(), WorkoutSession.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return Page(
        items=[serialize_session(session) for session in sessions],
        page=page,
        page_size=page_size,
        total=total,
    )


def serialize_workout(workout: Workout) -> PersistedWorkout:
    return PersistedWorkout(
        id=workout.id,
        name=workout.name,
        muscle_group=workout.muscle_group,
        difficulty=workout.difficulty,
        equipment=workout.equipment,
        goal=workout.goal,
        random_seed=workout.random_seed,
        blocks=[
            WorkoutBlockSchema(
                song=Song(
                    title=block.song_title,
                    artist=block.song_artist,
                    duration_ms=block.song_duration_ms,
                ),
                duration_seconds=block.duration_seconds,
                intervals=[
                    WorkoutIntervalSchema(
                        start_seconds=interval.start_seconds,
                        end_seconds=interval.end_seconds,
                        type=interval.interval_type,
                        exercise=interval.exercise_name,
                        exercise_id=interval.exercise_catalog_id,
                    )
                    for interval in block.intervals
                ],
            )
            for block in workout.blocks
        ],
        created_at=workout.created_at,
        updated_at=workout.updated_at,
    )


def serialize_session(session: WorkoutSession) -> PersistedWorkoutSession:
    feedback = None
    if session.feedback:
        feedback = FeedbackRead(
            id=session.feedback.id,
            rating=session.feedback.rating,
            notes=session.feedback.notes,
            created_at=session.feedback.created_at,
            updated_at=session.feedback.updated_at,
        )
    return PersistedWorkoutSession(
        id=session.id,
        workout_id=session.workout_id,
        started_at=session.started_at,
        ended_at=session.ended_at,
        planned_duration_seconds=session.planned_duration_seconds,
        actual_elapsed_seconds=session.actual_elapsed_seconds,
        total_intervals=session.total_intervals,
        completed_intervals=session.completed_intervals,
        completed_work_intervals=session.completed_work_intervals,
        completed_song_blocks=session.completed_song_blocks,
        status=session.status,
        workout_snapshot=GeneratedWorkout.model_validate(session.workout_snapshot),
        feedback=feedback,
        created_at=session.created_at,
        updated_at=session.updated_at,
    )


def _generated_workout(workout: Workout) -> GeneratedWorkout:
    serialized = serialize_workout(workout)
    return GeneratedWorkout(
        muscle_group=serialized.muscle_group,
        difficulty=serialized.difficulty,
        equipment=serialized.equipment,
        goal=serialized.goal,
        blocks=serialized.blocks,
    )


def _owned_workout(database: Session, user: User, workout_id: uuid.UUID) -> Workout:
    workout = database.scalar(
        select(Workout)
        .where(Workout.id == workout_id, Workout.user_id == user.id)
        .options(selectinload(Workout.blocks).selectinload(WorkoutBlock.intervals))
    )
    if workout is None:
        raise PersistenceNotFoundError("Workout not found.")
    return workout


def _owned_session(database: Session, user: User, session_id: uuid.UUID) -> WorkoutSession:
    session = database.scalar(
        select(WorkoutSession)
        .where(WorkoutSession.id == session_id, WorkoutSession.user_id == user.id)
        .options(selectinload(WorkoutSession.feedback))
    )
    if session is None:
        raise PersistenceNotFoundError("Workout session not found.")
    return session


def _validate_blocks(blocks: list[WorkoutBlockSchema]) -> None:
    for block in blocks:
        if not block.intervals:
            raise PersistenceValidationError("Workout blocks must contain at least one interval.")
        if block.intervals[0].start_seconds != 0:
            raise PersistenceValidationError("The first interval must start at zero.")
        if block.intervals[-1].end_seconds != block.duration_seconds:
            raise PersistenceValidationError("The final interval must end at the block duration.")
        for previous, current in zip(block.intervals, block.intervals[1:], strict=False):
            if previous.end_seconds != current.start_seconds:
                raise PersistenceValidationError("Workout intervals must be contiguous.")


def _validate_session_counts(
    *,
    completed_intervals: int,
    completed_work_intervals: int,
    completed_song_blocks: int,
    total_intervals: int,
    total_blocks: int,
) -> None:
    if completed_intervals > total_intervals:
        raise PersistenceValidationError("completed_intervals exceeds the workout total.")
    if completed_work_intervals > completed_intervals:
        raise PersistenceValidationError("completed_work_intervals exceeds completed_intervals.")
    if completed_song_blocks > total_blocks:
        raise PersistenceValidationError("completed_song_blocks exceeds the workout total.")


def _commit(database: Session) -> None:
    try:
        database.commit()
    except IntegrityError as error:
        database.rollback()
        raise PersistenceConflictError("The database rejected a conflicting record.") from error
    except SQLAlchemyError as error:
        database.rollback()
        raise PersistenceUnavailableError("The database operation could not be completed.") from error
