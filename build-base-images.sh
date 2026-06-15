#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# build-base-images.sh
#
# Builds and pushes the GROWebby tool base images to Docker Hub.
# Run this script when:
#   - requirements.txt changes
#   - package.json / package-lock.json changes
#   - GROMACS version is upgraded
#   - Base OS / Python / Node version is bumped
#
# Usage:
#   ./build-base-images.sh [OPTIONS]
#
# Options:
#   --push          Push images to Docker Hub after building (default: build only)
#   --cpu           Build the CPU backend base image
#   --cuda          Build the CUDA backend base image
#   --metal         Build the Metal/OpenCL backend base image
#   --frontend      Build the frontend base image
#   --all           Build all base images (default when no target is given)
#   --tag TAG       Docker tag to use (default: latest)
#   --help          Show this message
#
# Examples:
#   ./build-base-images.sh --all --push
#   ./build-base-images.sh --cpu --push --tag 1.1.0
#   ./build-base-images.sh --frontend --push
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO="ramsainanduri"
TAG="latest"
DO_PUSH=false
BUILD_CPU=false
BUILD_CUDA=false
BUILD_METAL=false
BUILD_FRONTEND=false
BUILD_ALL=true

# ── Parse arguments ───────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --push)      DO_PUSH=true ;;
    --cpu)       BUILD_CPU=true;    BUILD_ALL=false ;;
    --cuda)      BUILD_CUDA=true;   BUILD_ALL=false ;;
    --metal)     BUILD_METAL=true;  BUILD_ALL=false ;;
    --frontend)  BUILD_FRONTEND=true; BUILD_ALL=false ;;
    --all)       BUILD_ALL=true ;;
    --tag)       TAG="$2"; shift ;;
    --help)
      sed -n '/^# Usage/,/^# ─/p' "$0"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
  shift
done

if $BUILD_ALL; then
  BUILD_CPU=true
  BUILD_CUDA=true
  BUILD_METAL=true
  BUILD_FRONTEND=true
fi

# ── Helper ────────────────────────────────────────────────────────────────────
build_and_push() {
  local name="$1"
  local context="$2"
  local dockerfile="${3:-$context/Dockerfile}"
  local copy_src="${4:-}"   # optional: file to copy into context before building
  local image="${REPO}/${name}:${TAG}"

  echo ""
  echo "════════════════════════════════════════════════════════════════"
  echo "  Building: ${image}"
  echo "  Context:  ${context}"
  echo "════════════════════════════════════════════════════════════════"

  # Some base images need requirements.txt / package files from the app dirs
  if [[ -n "$copy_src" ]]; then
    cp $copy_src "${context}/"
    trap "rm -f ${context}/$(basename $copy_src)" EXIT
  fi

  docker build -t "${image}" -f "${dockerfile}" "${context}"

  if $DO_PUSH; then
    echo "  Pushing:  ${image}"
    docker push "${image}"
  fi
}

# ── Build targets ─────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if $BUILD_CPU; then
  build_and_push \
    "growebby-base-backend-cpu" \
    "docker/base-backend-cpu" \
    "docker/base-backend-cpu/Dockerfile" \
    "backend/requirements.txt"
fi

if $BUILD_CUDA; then
  build_and_push \
    "growebby-base-backend-cuda" \
    "docker/base-backend-cuda" \
    "docker/base-backend-cuda/Dockerfile" \
    "backend/requirements.txt"
fi

if $BUILD_METAL; then
  build_and_push \
    "growebby-base-backend-metal" \
    "docker/base-backend-metal" \
    "docker/base-backend-metal/Dockerfile" \
    "backend/requirements.txt"
fi

if $BUILD_FRONTEND; then
  cp frontend/package.json docker/base-frontend/
  cp frontend/package-lock.json docker/base-frontend/ 2>/dev/null || true
  trap "rm -f docker/base-frontend/package.json docker/base-frontend/package-lock.json" EXIT
  build_and_push \
    "growebby-base-frontend" \
    "docker/base-frontend"
fi

echo ""
echo "Done. Images built$(if $DO_PUSH; then echo " and pushed"; fi):"
$BUILD_CPU     && echo "   ${REPO}/growebby-base-backend-cpu:${TAG}"
$BUILD_CUDA    && echo "   ${REPO}/growebby-base-backend-cuda:${TAG}"
$BUILD_METAL   && echo "   ${REPO}/growebby-base-backend-metal:${TAG}"
$BUILD_FRONTEND && echo "   ${REPO}/growebby-base-frontend:${TAG}"
echo ""
if ! $DO_PUSH; then
  echo " To push to Docker Hub, re-run with --push"
fi
