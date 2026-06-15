# ── GROMACS Apple Metal / macOS GPU engine ─────────────────────────────────────
# Accelerated via OpenCL on Apple Silicon (M-series) and Intel Macs with AMD/Intel GPUs.
# GROMACS uses OpenCL as its GPU backend on macOS — Metal is accessed through Apple's
# OpenCL runtime layer automatically on M-series hardware.
#
# Base: Python 3.14 slim (Debian) + GROMACS 2026.2 compiled with -DGMX_GPU=OpenCL
# Profile: docker compose --profile metal up
# ──────────────────────────────────────────────────────────────────────────────
FROM python:3.14-slim

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# ── Build dependencies ────────────────────────────────────────────────────────
# Note: ocl-icd-opencl-dev provides the OpenCL ICD loader used by GROMACS.
# The host's GPU runtime (Apple's OpenCL.framework via Docker Desktop on macOS)
# is made available through the ICD mechanism automatically.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      build-essential \
      ca-certificates \
      cmake \
      curl \
      libfftw3-dev \
      libhwloc-dev \
      ocl-icd-opencl-dev \
      opencl-headers \
      python3 \
      python3-pip \
    && rm -rf /var/lib/apt/lists/*

# ── Build GROMACS 2026.2 with OpenCL GPU support ──────────────────────────────
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

# ── Runtime environment ───────────────────────────────────────────────────────
ENV PATH="/usr/local/gromacs/bin:${PATH}" \
    GMXBIN="/usr/local/gromacs/bin" \
    CMAKE_PREFIX_PATH="/usr/local/gromacs" \
    LD_LIBRARY_PATH="/usr/local/gromacs/lib:${LD_LIBRARY_PATH}" \
    gmxapi_ROOT="/usr/local/gromacs"

# ── Install gmxapi Python bindings ────────────────────────────────────────────
RUN python3 -m pip install --no-cache-dir --break-system-packages "gmxapi>=0.4.2" \
    && python3 -c "import gmxapi; print('gmxapi', gmxapi.__version__)" \
    && gmx --version

WORKDIR /work
