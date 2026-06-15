FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

WORKDIR /app

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
    LD_LIBRARY_PATH="/usr/local/gromacs/lib:${LD_LIBRARY_PATH}" \
    gmxapi_ROOT="/usr/local/gromacs" \
    GROMACS_BINARY="/usr/local/gromacs/bin/gmx" \
    GROMACS_EXECUTION_MODE="backend-gmx-2026.2"

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["bash", "-lc", "python manage.py migrate && python manage.py runserver 0.0.0.0:8000"]
