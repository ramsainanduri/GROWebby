# ── GROMACS CUDA engine ────────────────────────────────────────────────────────
# Base: latest CUDA 13 + cuDNN on Ubuntu 24.04 LTS (Noble Numbat)
# GROMACS: 2025.4 (latest stable as of June 2026)
# ──────────────────────────────────────────────────────────────────────────────
FROM nvidia/cuda:13.0.0-cudnn-devel-ubuntu24.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# ── System dependencies ───────────────────────────────────────────────────────
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      build-essential \
      ca-certificates \
      cmake \
      curl \
      fftw3-dev \
      git \
      libhwloc-dev \
      libopenmpi-dev \
      openmpi-bin \
      python3 \
      python3-pip \
      python3-venv \
    && rm -rf /var/lib/apt/lists/*

# ── Build GROMACS 2025.4 with CUDA GPU support ────────────────────────────────
RUN curl -fsSL https://ftp.gromacs.org/gromacs/gromacs-2025.4.tar.gz -o /tmp/gromacs.tar.gz \
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

# ── Runtime environment ───────────────────────────────────────────────────────
ENV PATH="/usr/local/gromacs/bin:${PATH}" \
    GMXBIN="/usr/local/gromacs/bin" \
    CMAKE_PREFIX_PATH="/usr/local/gromacs" \
    LD_LIBRARY_PATH="/usr/local/gromacs/lib:${LD_LIBRARY_PATH}"

# ── Install gmxapi Python bindings ────────────────────────────────────────────
RUN python3 -m pip install --no-cache-dir --break-system-packages "gmxapi>=0.4.2" \
    && python3 -c "import gmxapi; print('gmxapi', gmxapi.__version__)" \
    && gmx --version

WORKDIR /work
