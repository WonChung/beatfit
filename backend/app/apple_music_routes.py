from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Query

from app.api_models import AppleDeveloperToken, AppleMusicProviderIdentifier, AppleMusicTrack, Page
from app.apple_music import (
    AppleMusicCatalog,
    AppleMusicConfigurationError,
    AppleMusicUpstreamError,
    DeveloperTokenService,
    get_apple_music_catalog,
    get_developer_token_service,
)
from app.auth import get_current_user
from app.db_models import User


router = APIRouter(prefix="/music/apple", tags=["Apple Music"])


@router.get("/developer-token", response_model=AppleDeveloperToken)
def developer_token(
    origin: str | None = Header(default=None),
    _user: User = Depends(get_current_user),
    service: DeveloperTokenService = Depends(get_developer_token_service),
) -> AppleDeveloperToken:
    try:
        token, expires_at = service.issue(origin)
        return AppleDeveloperToken(token=token, expires_at=expires_at)
    except AppleMusicConfigurationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@router.get("/catalog/search", response_model=Page[AppleMusicTrack])
def catalog_search(
    term: str = Query(min_length=1, max_length=120),
    storefront: str = Query(default="us", pattern=r"^[a-z]{2}$"),
    limit: int = Query(default=25, ge=1, le=25),
    _user: User = Depends(get_current_user),
    catalog: AppleMusicCatalog = Depends(get_apple_music_catalog),
) -> Page[AppleMusicTrack]:
    try:
        payload = catalog.search(term.strip(), storefront, limit)
        resources = payload.get("results", {}).get("songs", {}).get("data", [])
        tracks = [track for resource in resources if (track := _normalize_track(resource, storefront))]
        return Page(items=tracks, page=1, page_size=limit, total=len(tracks))
    except AppleMusicConfigurationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except AppleMusicUpstreamError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


def _normalize_track(resource: Any, storefront: str) -> AppleMusicTrack | None:
    if not isinstance(resource, dict) or not isinstance(resource.get("id"), str):
        return None
    attributes = resource.get("attributes")
    if not isinstance(attributes, dict):
        attributes = {}
    artwork = attributes.get("artwork") if isinstance(attributes.get("artwork"), dict) else {}
    artwork_url = artwork.get("url") if isinstance(artwork.get("url"), str) else None
    if artwork_url:
        artwork_url = artwork_url.replace("{w}", "600").replace("{h}", "600")
    duration = attributes.get("durationInMillis")
    return AppleMusicTrack(
        id=resource["id"],
        title=attributes.get("name") if isinstance(attributes.get("name"), str) else "Unknown title",
        artist=attributes.get("artistName") if isinstance(attributes.get("artistName"), str) else "Unknown artist",
        duration_ms=duration if isinstance(duration, int) and duration > 0 else None,
        artwork_url=artwork_url,
        is_playable=attributes.get("playParams") is not None,
        provider_identifier=AppleMusicProviderIdentifier(
            provider="apple_music", catalog_id=resource["id"], storefront=storefront
        ),
    )
