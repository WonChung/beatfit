"""Temporary ownership dependency. Replace this module when authentication is added."""

import uuid

from sqlalchemy.orm import Session

from app.db_models import User


# Fixed server-side identity. Ownership IDs are never accepted from API clients.
DEVELOPMENT_USER_ID = uuid.UUID("00000000-0000-4000-8000-000000000001")
DEVELOPMENT_USER_EMAIL = "developer@local.beatfit"


def ensure_development_user(database: Session) -> User:
    user = database.get(User, DEVELOPMENT_USER_ID)
    if user is None:
        user = User(
            id=DEVELOPMENT_USER_ID,
            email=DEVELOPMENT_USER_EMAIL,
            display_name="BeatFit Developer",
            is_temporary=True,
        )
        database.add(user)
        database.flush()
    return user
