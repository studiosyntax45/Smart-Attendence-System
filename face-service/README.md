# PES Smart Attendance Face Service

The face service performs optional server-side face enrollment and verification for the local attendance demo. It is designed to run only on your laptop and listens on `http://localhost:8000`.

## Requirements

- Python 3.11+
- The project root `.env` with `FACE_SERVICE_URL=http://localhost:8000`

## Install

From the project root:

```powershell
python -m venv face-service\.venv
face-service\.venv\Scripts\python -m pip install -r face-service\requirements.txt
```

## Run locally

```powershell
face-service\.venv\Scripts\python -m uvicorn app:app --app-dir face-service --host 127.0.0.1 --port 8000
```

The service health endpoint is `http://localhost:8000/health`.

Optional local settings can be placed in the terminal environment before starting it:

- `FACE_SERVICE_TOKEN` protects requests with a shared local token.
- `FACE_MODEL` selects the DeepFace model (default: `Facenet512`).
- `FACE_DETECTOR` selects the detector backend (default: `opencv`).
- `FACE_WARM_ON_STARTUP=false` skips the startup model warm-up.

## Tests

```powershell
face-service\.venv\Scripts\python -m unittest discover -s face-service\tests
```