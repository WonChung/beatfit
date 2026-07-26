"""Pure ASGI request-body limits for JSON API endpoints."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from starlette.responses import JSONResponse

MAX_REQUEST_BODY_BYTES = 1_048_576

ASGIMessage = dict[str, Any]
Receive = Callable[[], Awaitable[ASGIMessage]]
Send = Callable[[ASGIMessage], Awaitable[None]]


class RequestBodyLimitMiddleware:
    """Reject bodies above the fixed API limit, including chunked requests."""

    def __init__(self, app: Any, max_body_bytes: int = MAX_REQUEST_BODY_BYTES):
        self.app = app
        self.max_body_bytes = max_body_bytes

    async def __call__(self, scope: dict[str, Any], receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        content_length = _content_length(scope)
        if content_length is not None and content_length > self.max_body_bytes:
            await self._reject(scope, receive, send)
            return

        received_bytes = 0
        too_large = False
        response_started = False

        async def receive_limited() -> ASGIMessage:
            nonlocal received_bytes, too_large
            message = await receive()
            if message["type"] == "http.request":
                received_bytes += len(message.get("body", b""))
                if received_bytes > self.max_body_bytes:
                    too_large = True
                    return {"type": "http.disconnect"}
            return message

        async def send_limited(message: ASGIMessage) -> None:
            nonlocal response_started
            if too_large:
                return
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, receive_limited, send_limited)
        except Exception:
            if not too_large:
                raise

        if too_large and not response_started:
            await self._reject(scope, receive, send)

    async def _reject(self, scope: dict[str, Any], receive: Receive, send: Send) -> None:
        request_id = scope.get("state", {}).get("request_id", "-")
        response = JSONResponse(
            status_code=413,
            content={
                "detail": f"Request body must not exceed {self.max_body_bytes} bytes.",
                "request_id": request_id,
            },
        )
        await response(scope, receive, send)


def _content_length(scope: dict[str, Any]) -> int | None:
    for name, value in scope.get("headers", []):
        if name.lower() != b"content-length":
            continue
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            return None
        return parsed if parsed >= 0 else None
    return None
