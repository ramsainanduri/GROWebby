# ── GROWebby Backend Base Image ────────────────────────────────────────────────
# This image contains ONLY the tools and Python dependencies.
# It does NOT contain any application code.
#
# Push to Docker Hub when requirements.txt changes or GROMACS is upgraded.
# Application code is layered on top in backend/Dockerfile.
#
# Build:  docker build -t ramsainanduri/growebby-base-backend:latest docker/base-backend/
# Push:   docker push ramsainanduri/growebby-base-backend:latest
# ──────────────────────────────────────────────────────────────────────────────
FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

# ── System build dependencies ─────────────────────────────────────────────────
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      build-essential \
      ca-certificates \
      cmake \
      curl \
      libfftw3-dev \
      libhwloc-dev \
      libopenmpi-dev \
    && rm -rf /var/lib/apt/lists/*

# ── Build GROMACS 2026.2 (CPU, no GPU) from source ───────────────────────────
RUN curl -fsSL https://ftp.gromacs.org/gromacs/gromacs-2026.2.tar.gz -o /tmp/gromacs.tar.gz \
    && mkdir -p /tmp/gromacs-src \
    && tar -xzf /tmp/gromacs.tar.gz -C /tmp/gromacs-src --strip-components=1 \
    && cmake -S /tmp/gromacs-src -B /tmp/gromacs-build \
      -DGMX_BUILD_OWN_FFTW=ON \
      -DGMX_GPU=OFF \
      -DGMX_MPI=OFF \
      -DGMX_OPENMP=ON \
      -DREGRESSIONTEST_DOWNLOAD=OFF \
      -DCMAKE_INSTALL_PREFIX=/usr/local/gromacs \
    && cmake --build /tmp/gromacs-build --parallel "$(nproc)" \
    && cmake --install /tmp/gromacs-build \
    && rm -rf /tmp/gromacs*

# ── GROMACS runtime environment ───────────────────────────────────────────────
ENV PATH="/usr/local/gromacs/bin:${PATH}" \
    GMXBIN="/usr/local/gromacs/bin" \
    CMAKE_PREFIX_PATH="/usr/local/gromacs" \
    LD_LIBRARY_PATH="/usr/local/gromacs/lib:${LD_LIBRARY_PATH}" \
    gmxapi_ROOT="/usr/local/gromacs" \
    GROMACS_BINARY="/usr/local/gromacs/bin/gmx" \
    GROMACS_EXECUTION_MODE="backend-gmx-2026.2"

# ── Python dependencies ───────────────────────────────────────────────────────
# Copy only requirements.txt so this layer is cached as long as deps don't change.
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && rm requirements.txt

# Verify GROMACS is functional
RUN gmx --version
