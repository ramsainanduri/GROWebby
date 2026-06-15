# ── GROMACS CPU engine ─────────────────────────────────────────────────────────
# GROMACS 2026.2 built from source for machines without CUDA.
# ──────────────────────────────────────────────────────────────────────────────
FROM python:3.14-slim

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      build-essential \
      ca-certificates \
      cmake \
      curl \
      libfftw3-dev \
      libhwloc-dev \
      python3-pip \
    && rm -rf /var/lib/apt/lists/*

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

ENV PATH="/usr/local/gromacs/bin:${PATH}" \
    GMXBIN="/usr/local/gromacs/bin" \
    CMAKE_PREFIX_PATH="/usr/local/gromacs" \
    LD_LIBRARY_PATH="/usr/local/gromacs/lib:${LD_LIBRARY_PATH}"

RUN python3 -m pip install --no-cache-dir --break-system-packages "gmxapi>=0.4.2" \
    && python3 -c "import gmxapi; print('gmxapi', gmxapi.__version__)" \
    && gmx --version

WORKDIR /work
