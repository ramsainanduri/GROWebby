# ── GROMACS CUDA engine ────────────────────────────────────────────────────────
# Base: CUDA 12.1.1 (required by GROMACS 2026.2) on Ubuntu 22.04 LTS
# GROMACS: 2026.2
# ──────────────────────────────────────────────────────────────────────────────
FROM nvidia/cuda:12.1.1-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# ── System dependencies ───────────────────────────────────────────────────────
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      build-essential \
      ca-certificates \
      curl \
      libfftw3-dev \
      git \
      libhwloc-dev \
      libopenmpi-dev \
      openmpi-bin \
      python3 \
      python3-dev \
      python3-pip \
      python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip and install a newer CMake (>= 3.28) required by GROMACS 2026.2
RUN python3 -m pip install --no-cache-dir --upgrade pip \
    && python3 -m pip install --no-cache-dir --break-system-packages cmake

# ── Build GROMACS 2026.2 with CUDA GPU support ────────────────────────────────
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

# ── Runtime environment ───────────────────────────────────────────────────────
ENV PATH="/usr/local/gromacs/bin:${PATH}" \
    GMXBIN="/usr/local/gromacs/bin" \
    CMAKE_PREFIX_PATH="/usr/local/gromacs" \
    LD_LIBRARY_PATH="/usr/local/gromacs/lib:${LD_LIBRARY_PATH}" \
    gmxapi_ROOT="/usr/local/gromacs"

# ── Install gmxapi Python bindings ────────────────────────────────────────────
# Strip OpenMP_CUDA from CMake targets because gmxapi does not enable the CUDA language
RUN sed -i 's/OpenMP::OpenMP_CUDA//g' /usr/local/gromacs/share/cmake/gromacs/libgromacs.cmake \
    && python3 -m pip install --no-cache-dir --break-system-packages "gmxapi>=0.4.2" \
    && python3 -c "import gmxapi; print('gmxapi', gmxapi.__version__)" \
    && gmx --version

WORKDIR /work
