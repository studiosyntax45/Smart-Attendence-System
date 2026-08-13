from __future__ import annotations

import os

from face_logic import VALID_METRICS


def _clean(name: str, default: str) -> str:
    value = os.getenv(name, default).strip()
    return value or default
MODEL_NAME = _clean("FACE_MODEL", "Facenet512")
DETECTOR_BACKEND = _clean("FACE_DETECTOR", "opencv")

DISTANCE_METRIC = _clean("FACE_DISTANCE_METRIC", "cosine")
if DISTANCE_METRIC not in VALID_METRICS:
    DISTANCE_METRIC = "cosine"
ENFORCE_DETECTION = _clean("FACE_ENFORCE_DETECTION", "true").lower() != "false"
SERVICE_TOKEN = os.getenv("FACE_SERVICE_TOKEN", "").strip()
WARM_ON_STARTUP = _clean("FACE_WARM_ON_STARTUP", "true").lower() != "false"


def summary() -> dict:
    """Non-secret config, safe to expose on /health."""
    return {
        "model": MODEL_NAME,
        "detector": DETECTOR_BACKEND,
        "metric": DISTANCE_METRIC,
        "enforce_detection": ENFORCE_DETECTION,
        "auth_required": bool(SERVICE_TOKEN),
    }
