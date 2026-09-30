"""Bound body size before JSON buffering or multipart temporary-file writes."""

import re

from starlette.datastructures import Headers
from starlette.exceptions import HTTPException
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

MAX_REQUEST_BODY_BYTES = 64 * 1024
MAX_UPLOAD_BODY_BYTES = 82 * 1024 * 1024
_UPLOAD_PATH = re.compile(r"^/devices/[0-9]+/images/?$")
_TOO_LARGE = "Cererea este prea mare. Redu dimensiunea datelor sau a fotografiilor."


class RequestBodyLimitMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = Headers(scope=scope)
        multipart_upload = (
            scope["method"] == "POST"
            and _UPLOAD_PATH.fullmatch(scope["path"])
            and headers.get("content-type", "").partition(";")[0].strip().lower() == "multipart/form-data"
        )
        limit = MAX_UPLOAD_BODY_BYTES if multipart_upload else MAX_REQUEST_BODY_BYTES
        content_length = headers.get("content-length")
        if content_length is not None:
            try:
                declared_length = int(content_length)
            except ValueError:
                await JSONResponse(status_code=400, content={"detail": "Content-Length invalid."})(scope, receive, send)
                return
            if declared_length > limit:
                await JSONResponse(status_code=413, content={"detail": _TOO_LARGE})(scope, receive, send)
                return

        received = 0
        response_started = False
        exceeded = False
        rejection_sent = False
        rejection = JSONResponse(status_code=413, content={"detail": _TOO_LARGE})

        async def limited_receive() -> Message:
            nonlocal received, exceeded
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
                    exceeded = True
                    # Starlette closes partially spooled files when its stream
                    # fails. Some middleware/parser versions wrap the exception
                    # as a generic 400; track_send below preserves the true 413.
                    raise HTTPException(status_code=413, detail=_TOO_LARGE)
            return message

        async def track_send(message: Message) -> None:
            nonlocal response_started, rejection_sent
            if exceeded:
                if message["type"] == "http.response.start":
                    response_started = True
                    await send({
                        "type": "http.response.start", "status": 413,
                        "headers": rejection.raw_headers,
                    })
                elif message["type"] == "http.response.body" and not rejection_sent:
                    rejection_sent = True
                    await send({"type": "http.response.body", "body": rejection.body, "more_body": False})
                return
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, limited_receive, track_send)
        except HTTPException as exc:
            # Also support a wrapped ASGI consumer without its own exception
            # handler. Never replace a response that has already started.
            if exc.status_code != 413 or response_started:
                raise
            await rejection(scope, receive, send)
