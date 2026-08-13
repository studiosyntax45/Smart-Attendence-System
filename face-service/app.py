from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

import config
import engine
from face_logic import (
    ImageDecodeError,
    decode_image_payload,
    is_valid_embedding,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("face-service")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    log.info("face-service starting — config: %s", config.summary())
    if config.WARM_ON_STARTUP:
        try:
            engine.warm_up()
            log.info("model warm-up complete: %s / %s", config.MODEL_NAME, config.DETECTOR_BACKEND)
        except Exception as exc:
            log.warning("model warm-up skipped: %s", exc)
    else:
        log.info("FACE_WARM_ON_STARTUP=false — model will load on first request")
    yield
    log.info("face-service shutting down")


app = FastAPI(
    title="PES Smart Attendance — Face Service",
    version="1.1.0",
    description="Server-side DeepFace identity verification (FACE_SERVICE_URL seam).",
    lifespan=lifespan,
)

_cors_origins_raw = os.getenv("FACE_CORS_ORIGINS", "http://localhost:4000,http://localhost:3000")
_cors_origins = [o.strip() for o in _cors_origins_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def require_token(x_face_service_token: str | None = Header(default=None)) -> None:
    """Reject callers without the shared secret, when one is configured."""
    if not config.SERVICE_TOKEN:
        return
    if x_face_service_token != config.SERVICE_TOKEN:
        raise HTTPException(status_code=401, detail="invalid or missing service token")


class RepresentRequest(BaseModel):
    image: str = Field(..., description="data-URL or base64 image of a single face")


class VerifyRequest(BaseModel):
    image: str = Field(..., description="live frame — data-URL or base64")
    reference_embedding: list[float] | None = Field(
        default=None, description="stored enrolment embedding to match against"
    )
    reference_image: str | None = Field(
        default=None, description="alternative: an enrolment image to match against"
    )


@app.get("/")
def root() -> dict:
    return {
        "service": "PES Smart Attendance Face Service",
        "status": "running",
        "version": "1.1.0",
        "docs": "/docs",
        "health": "/health",
        "warmup": "/warmup",
    }


@app.get("/health")
def health() -> dict:
    return {"status": "ok", **config.summary()}


@app.post("/warmup", dependencies=[Depends(require_token)])
def warmup() -> dict:
    """Trigger a manual model warm-up (useful after cold deploy)."""
    try:
        engine.warm_up()
        return {"status": "ok", "model": config.MODEL_NAME, "already_warm": engine._warmed}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"warm-up failed: {exc}") from exc


@app.post("/represent", dependencies=[Depends(require_token)])
def represent(req: RepresentRequest) -> dict:
    image_bytes = _decode(req.image, field="image")
    try:
        embedding = engine.represent(image_bytes)
    except engine.NoFaceError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except engine.MultipleFacesError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    log.info("/represent: ok, dims=%d model=%s", len(embedding), config.MODEL_NAME)
    return {
        "embedding": embedding,
        "dims": len(embedding),
        "model": config.MODEL_NAME,
        "detector": config.DETECTOR_BACKEND,
    }


@app.post("/verify", dependencies=[Depends(require_token)])
def verify(req: VerifyRequest) -> dict:
    image_bytes = _decode(req.image, field="image")

    has_embedding = req.reference_embedding is not None
    has_image = bool(req.reference_image)
    if has_embedding == has_image:
        raise HTTPException(
            status_code=400,
            detail="provide exactly one of reference_embedding or reference_image",
        )

    try:
        if has_embedding:
            if not is_valid_embedding(req.reference_embedding):
                raise HTTPException(
                    status_code=400, detail="reference_embedding is malformed"
                )
            result = engine.verify_against_embedding(
                image_bytes, [float(x) for x in req.reference_embedding]
            )
        else:
            ref_bytes = _decode(req.reference_image, field="reference_image")
            result = engine.verify_pair(image_bytes, ref_bytes)
    except engine.NoFaceError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except engine.MultipleFacesError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    log.info("/verify: verified=%s distance=%.4f", result.get("verified"), result.get("distance"))
    return result


def _decode(payload: str, *, field: str) -> bytes:
    try:
        return decode_image_payload(payload)
    except ImageDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"{field}: {exc}") from exc


@app.exception_handler(Exception)
async def unhandled(_request, exc: Exception) -> JSONResponse:
    """Never leak a stack trace to the client; log it, return a clean 500."""
    log.exception("unhandled error: %s", exc)
    return JSONResponse(status_code=500, content={"detail": "internal error"})
