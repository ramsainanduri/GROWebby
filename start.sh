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

docker compose up --build -d

URL="http://localhost:5173"
if command -v open >/dev/null 2>&1; then
  open "$URL"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL"
fi

echo "GROWebby is starting at $URL"
