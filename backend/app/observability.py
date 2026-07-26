"""Structured logging, request correlation, and safe API error responses."""

from __future__ import annotations

import contextvars
import json
import logging
import re
import sys
import time
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from app.config import RuntimeSettings, log_level_number

REQUEST_ID_HEADER = "X-Request-ID"
REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{1,128}$")
request_id_context: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")


class JsonFormatter(logging.Formatter):
    """Serialize an allowlisted set of log fields as one JSON object per line."""

    extra_fields = (
        "event",
        "request_id",
        "method",
        "path",
        "status_code",
        "duration_ms",
        "exception_type",
    )

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", request_id_context.get()),
        }
        for field in self.extra_fields:
            if field == "request_id":
                continue
            value = getattr(record, field, None)
            if value is not None:
                payload[field] = value
        return json.dumps(payload, separators=(",", ":"), ensure_ascii=True)


def configure_logging(settings: RuntimeSettings) -> None:
    """Configure BeatFit logs without recording headers, bodies, or credentials."""

    logger = logging.getLogger("beatfit")
    logger.setLevel(log_level_number(settings))
    logger.propagate = False
    if not any(getattr(handler, "_beatfit_json", False) for handler in logger.handlers):
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(JsonFormatter())
        handler._beatfit_json = True  # type: ignore[attr-defined]
        logger.addHandler(handler)


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = _request_id(request.headers.get(REQUEST_ID_HEADER))
        request.state.request_id = request_id
        context_token = request_id_context.set(request_id)
        started_at = time.perf_counter()
        logger = logging.getLogger("beatfit.http")
        try:
            response = await call_next(request)
            response.headers[REQUEST_ID_HEADER] = request_id
            response.headers.setdefault("X-Content-Type-Options", "nosniff")
            response.headers.setdefault("Referrer-Policy", "no-referrer")
            logger.info(
                "Request completed",
                extra={
                    "event": "http.request.completed",
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                    "duration_ms": round((time.perf_counter() - started_at) * 1000, 2),
                },
            )
            return response
        except Exception as error:
            logger.error(
                "Request failed",
                extra={
                    "event": "http.request.failed",
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "duration_ms": round((time.perf_counter() - started_at) * 1000, 2),
                    "exception_type": type(error).__name__,
                },
            )
            raise
        finally:
            request_id_context.reset(context_token)


def install_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(HTTPException)
    async def handle_http_exception(request: Request, error: HTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=error.status_code,
            content={
                "detail": jsonable_encoder(error.detail),
                "request_id": _state_request_id(request),
            },
            headers=error.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        request: Request, error: RequestValidationError
    ) -> JSONResponse:
        validation_errors = [
            {
                "location": [str(part) for part in issue.get("loc", ())],
                "message": issue.get("msg", "Invalid value."),
                "type": issue.get("type", "validation_error"),
            }
            for issue in error.errors()
        ]
        return JSONResponse(
            status_code=422,
            content={
                "detail": validation_errors,
                "request_id": _state_request_id(request),
            },
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, error: Exception) -> JSONResponse:
        request_id = _state_request_id(request)
        logging.getLogger("beatfit.errors").error(
            "Unhandled application error",
            extra={
                "event": "application.error.unhandled",
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "exception_type": type(error).__name__,
            },
        )
        return JSONResponse(
            status_code=500,
            content={
                "detail": "An unexpected error occurred.",
                "request_id": request_id,
            },
        )


def _request_id(candidate: str | None) -> str:
    if candidate and REQUEST_ID_PATTERN.fullmatch(candidate):
        return candidate
    return str(uuid.uuid4())


def _state_request_id(request: Request) -> str:
    return getattr(request.state, "request_id", request_id_context.get())
