# ── GROWebby Backend Base Image — CUDA Profile ─────────────────────────────────
# Contains: CUDA 12.1.1 + Python + GROMACS 2026.2 (CUDA GPU) + pip deps
# Does NOT contain application code.
#
# Rebuild and push when requirements.txt or GROMACS/CUDA version changes.
# Build:  docker build -t ramsainanduri/growebby-base-backend-cuda:latest docker/base-backend-cuda/
# Push:   docker push ramsainanduri/growebby-base-backend-cuda:latest
# ──────────────────────────────────────────────────────────────────────────────
FROM nvidia/cuda:12.1.1-devel-ubuntu22.04

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

# ── System dependencies ───────────────────────────────────────────────────────
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      build-essential \
      ca-certificates \
      cmake \
      curl \
      git \
      libfftw3-dev \
      libhwloc-dev \
      libopenmpi-dev \
      openmpi-bin \
      python3 \
      python3-dev \
      python3-pip \
      python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip and install newer CMake (>= 3.28 required by GROMACS 2026.2)
RUN python3 -m pip install --no-cache-dir --upgrade pip \
    && python3 -m pip install --no-cache-dir --break-system-packages cmake

# ── Build GROMACS 2026.2 (CUDA GPU) ─────────────────────────────────────────
RUN curl -fsSL https://ftp.gromacs.org/gromacs/gromacs-2026.2.tar.gz -o /tmp/gromacs.tar.gz \
    && mkdir -p /tmp/gromacs-src \
    && tar -xzf /tmp/gromacs.tar.gz -C /tmp/gromacs-src --strip-components=1 \
    && cmake -S /tmp/gromacs-src -B /tmp/gromacs-build \
      -DGMX_BUILD_OWN_FFTW=ON \
      -DGMX_GPU=CUDA \
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
    LD_LIBRARY_PATH="/usr/local/gromacs/lib:${LD_LIBRARY_PATH}" \
    gmxapi_ROOT="/usr/local/gromacs" \
    GROMACS_BINARY="/usr/local/gromacs/bin/gmx" \
    GROMACS_EXECUTION_MODE="backend-gmx-2026.2"

# Fix gmxapi CMake target compatibility with CUDA
RUN sed -i 's/OpenMP::OpenMP_CUDA//g' /usr/local/gromacs/share/cmake/gromacs/libgromacs.cmake

# ── Python dependencies ───────────────────────────────────────────────────────
WORKDIR /app
COPY requirements.txt .
RUN python3 -m pip install --no-cache-dir --break-system-packages -r requirements.txt \
    && rm requirements.txt

RUN gmx --version
