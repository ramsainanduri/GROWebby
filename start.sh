#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Install Docker Desktop or Docker Engine and try again."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 is required. Update Docker and try again."
  exit 1
fi

if [ ! -f .env ]; then
  ./install.sh
fi

mkdir -p .app_state/media/workspaces .app_state/media/uploads

set -a
# shellcheck disable=SC1091
source .env
set +a

if [[ "${GROWEBBY_ENGINE:-}" == "mac-opencl-native" ]]; then
  GMX_BIN="${GROMACS_BINARY:-$(command -v gmx || true)}"
  if [[ -z "$GMX_BIN" || ! -x "$GMX_BIN" ]]; then
    echo "mac-opencl-native is selected, but GROMACS was not found at: ${GMX_BIN:-<empty>}"
    echo "Run ./install.sh after installing a native OpenCL-enabled GROMACS build."
    exit 1
  fi

  if ! "$GMX_BIN" --version 2>/dev/null | grep -qi "GPU support:.*OpenCL"; then
    echo "GROMACS was found at $GMX_BIN, but it does not report OpenCL GPU support."
    echo "Install or select a GROMACS build compiled with -DGMX_GPU=OpenCL for Apple Silicon GPU runs."
    exit 1
  fi

  mkdir -p .app_state
  if [[ -f .app_state/backend.pid ]] && kill -0 "$(cat .app_state/backend.pid)" 2>/dev/null; then
    kill "$(cat .app_state/backend.pid)" || true
  fi

  docker compose stop backend >/dev/null 2>&1 || true
  docker compose up --build -d frontend

  if [[ ! -x .venv/bin/python ]]; then
    python3 -m venv .venv
  fi
  .venv/bin/python -m pip install -q -r backend/requirements.txt
  (
    cd backend
    GROWEBBY_ENGINE="mac-opencl-native" \
    GROMACS_EXECUTION_MODE="native-opencl" \
    GROMACS_BINARY="$GMX_BIN" \
    GROMACS_WORK_ROOT="../.app_state/media/workspaces" \
    GROWEBBY_MEDIA_ROOT="../.app_state/media" \
    ../.venv/bin/python manage.py migrate
    GROWEBBY_ENGINE="mac-opencl-native" \
    GROMACS_EXECUTION_MODE="native-opencl" \
    GROMACS_BINARY="$GMX_BIN" \
    GROMACS_WORK_ROOT="../.app_state/media/workspaces" \
    GROWEBBY_MEDIA_ROOT="../.app_state/media" \
    nohup ../.venv/bin/python manage.py runserver 0.0.0.0:8000 > ../.app_state/backend.log 2>&1 &
    echo $! > ../.app_state/backend.pid
  )
else
  # Determine which engine service is active from the profile
  ENGINE_SERVICE=""
  case "${GROWEBBY_ENGINE:-}" in
    *cuda*)  ENGINE_SERVICE="gromacs-cuda-engine" ;;
    *cpu*)   ENGINE_SERVICE="gromacs-cpu-engine" ;;
    *metal*) ENGINE_SERVICE="gromacs-metal-engine" ;;
  esac

  # Explicitly pull the engine image from Docker Hub first.
  # Engine containers reuse the base-backend-{cpu,cuda,metal} images which are
  # already on Docker Hub. This ensures pull_policy: missing finds them locally
  # and never falls back to a local build unnecessarily.
  if [[ -n "$ENGINE_SERVICE" ]]; then
    echo "Checking Docker Hub for pre-built engine image ($ENGINE_SERVICE)..."
    if docker compose pull "$ENGINE_SERVICE" 2>/dev/null; then
      echo "Engine image pulled from Docker Hub."
    else
      echo "Not found on Docker Hub — will build locally. This may take 15-30 minutes."
    fi
  fi

  # Build thin app layers (backend + frontend) from base images, then start everything.
  docker compose up --build backend frontend -d
  docker compose up -d
fi

echo "Waiting for backend to initialize..."
sleep 5
if [[ "${GROWEBBY_ENGINE:-}" != "mac-opencl-native" ]]; then
  docker compose exec backend python manage.py shell -c "from django.contrib.auth import get_user_model; User = get_user_model(); User.objects.create_superuser('admin', 'admin@growebby.local', 'admin') if not User.objects.filter(username='admin').exists() else None" || true
fi

URL="http://localhost:5173"
if command -v open >/dev/null 2>&1; then
  open "$URL"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL"
fi

echo "GROWebby is starting at $URL"
