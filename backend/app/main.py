from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.apple_music_routes import router as apple_music_router
from app.config import RuntimeSettings, get_runtime_settings, validate_runtime_settings
from app.observability import (
    RequestContextMiddleware,
    configure_logging,
    install_exception_handlers,
)
from app.operational_routes import router as operational_router
from app.persistence_routes import router as persistence_router
from app.personalization_routes import router as personalization_router
from app.request_limits import RequestBodyLimitMiddleware
from app.routes import router


def create_app(settings: RuntimeSettings | None = None) -> FastAPI:
    runtime_settings = settings or get_runtime_settings()
    validate_runtime_settings(runtime_settings)
    configure_logging(runtime_settings)
    application = FastAPI(title="BeatFit API")

    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(runtime_settings.cors_allowed_origins),
        allow_credentials=runtime_settings.cors_allow_credentials,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
    )
    application.add_middleware(RequestBodyLimitMiddleware)
    application.add_middleware(RequestContextMiddleware)
    install_exception_handlers(application)

    application.include_router(operational_router)
    application.include_router(router)
    application.include_router(persistence_router)
    application.include_router(apple_music_router)
    application.include_router(personalization_router)
    return application


app = create_app()
