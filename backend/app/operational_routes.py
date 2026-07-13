"""Unauthenticated liveness and dependency-readiness checks."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db

router = APIRouter(tags=["operations"])


@router.get("/health")
def health() -> dict[str, str]:
    """Liveness does not depend on external services."""

    return {"status": "ok", "service": "beatfit-api"}


@router.get("/ready")
def readiness(database: Session = Depends(get_db)) -> dict[str, str]:
    """Readiness succeeds only when the configured database is reachable."""

    try:
        database.execute(text("SELECT 1"))
    except SQLAlchemyError:
        database.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The service is not ready.",
        ) from None
    return {"status": "ready", "database": "available"}
