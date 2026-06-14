# ── GROMACS CPU engine ─────────────────────────────────────────────────────────
# Base: Python 3.14 on Debian slim + GROMACS 2025.4 via apt (Ubuntu 24.04 package)
# Use this profile on machines without an NVIDIA GPU (including Apple Silicon via emulation)
# ──────────────────────────────────────────────────────────────────────────────
FROM python:3.14-slim

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      gromacs \
      python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /work
