# ── GROWebby Backend Base Image — Metal/OpenCL Profile ─────────────────────────
# Contains: Python 3.14 + OpenCL libs + GROMACS 2026.2 (OpenCL GPU) + pip deps
# Does NOT contain application code.
# Intended for macOS hosts with Apple Silicon or AMD/Intel GPUs via Docker Desktop.
#
# Rebuild and push when requirements.txt or GROMACS version changes.
# Build:  docker build -t ramsainanduri/growebby-base-backend-metal:latest docker/base-backend-metal/
# Push:   docker push ramsainanduri/growebby-base-backend-metal:latest
# ──────────────────────────────────────────────────────────────────────────────
FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

# ── System dependencies (includes OpenCL ICD loader) ─────────────────────────
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      build-essential \
      ca-certificates \
      cmake \
      curl \
      libfftw3-dev \
      libhwloc-dev \
      libopenmpi-dev \
      ocl-icd-opencl-dev \
      opencl-headers \
    && rm -rf /var/lib/apt/lists/*

# ── Build GROMACS 2026.2 (OpenCL GPU) ────────────────────────────────────────
RUN curl -fsSL https://ftp.gromacs.org/gromacs/gromacs-2026.2.tar.gz -o /tmp/gromacs.tar.gz \
    && mkdir -p /tmp/gromacs-src \
    && tar -xzf /tmp/gromacs.tar.gz -C /tmp/gromacs-src --strip-components=1 \
    && cmake -S /tmp/gromacs-src -B /tmp/gromacs-build \
      -DGMX_BUILD_OWN_FFTW=ON \
      -DGMX_GPU=OpenCL \
      -DGMX_MPI=OFF \
      -DGMX_OPENMP=ON \
      -DREGRESSIONTEST_DOWNLOAD=OFF \
      -DCMAKE_INSTALL_PREFIX=/usr/local/gromacs \
    && cmake --build /tmp/gromacs-build --parallel "$(nproc)" \
    && cmake --install /tmp/gromacs-build \
    && rm -rf /tmp/gromacs*

ENV PATH="/usr/local/gromacs/bin:${PATH}" \
    GMXBIN="/usr/local/gromacs/bin" \
    CMAKE_PREFIX_PATH="/usr/local/gromacs" \
    LD_LIBRARY_PATH="/usr/local/gromacs/lib" \
    gmxapi_ROOT="/usr/local/gromacs" \
    GROMACS_BINARY="/usr/local/gromacs/bin/gmx" \
    GROMACS_EXECUTION_MODE="backend-gmx-2026.2"

# ── Python dependencies ───────────────────────────────────────────────────────
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && rm requirements.txt

RUN gmx --version
