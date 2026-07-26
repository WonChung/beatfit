import asyncio

from app.request_limits import RequestBodyLimitMiddleware


def test_chunked_body_is_limited_without_content_length() -> None:
    sent: list[dict] = []
    incoming = [
        {"type": "http.request", "body": b"123", "more_body": True},
        {"type": "http.request", "body": b"45", "more_body": False},
    ]

    async def consume_body(scope, receive, send) -> None:
        while True:
            message = await receive()
            if message["type"] == "http.disconnect" or not message.get("more_body", False):
                break
        await send({"type": "http.response.start", "status": 204, "headers": []})
        await send({"type": "http.response.body", "body": b""})

    async def receive() -> dict:
        return incoming.pop(0)

    async def send(message: dict) -> None:
        sent.append(message)

    scope = {
        "type": "http",
        "method": "POST",
        "path": "/test",
        "headers": [],
        "state": {"request_id": "chunked-request"},
    }
    asyncio.run(RequestBodyLimitMiddleware(consume_body, max_body_bytes=4)(scope, receive, send))

    assert sent[0]["type"] == "http.response.start"
    assert sent[0]["status"] == 413
    assert b"chunked-request" in sent[1]["body"]
