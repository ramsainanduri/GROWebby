# Operations and System Administration Guide

This guide provides instructions for host environment setup, service management, runtime operations, configuration, and diagnostics for the GROWebby application.

---

## 1. System Requirements & Prerequisites

Before executing the setup (`install.sh`) or startup (`start.sh`) scripts, the host machine must satisfy the prerequisites for the selected execution profile.

### 1.1 CPU-Only Profile
* **Operating System:** Any Linux distribution, macOS, or Windows (via WSL2).
* **Hardware Architecture:** `x86_64` or `arm64` (Apple Silicon or ARM Linux).
* **Docker Engine:** Docker Engine 27.x or higher, and Docker Compose v2.

### 1.2 Apple Silicon GPU Profile (`mac-opencl-native`)
* **Hardware Architecture:** Apple M-series (M1/M2/M3/M4) processor.
* **GROMACS native installation:** A host GROMACS installation compiled with OpenCL GPU support. Install via Homebrew:
  ```bash
  brew install gromacs
  ```
  Verify OpenCL support by running `gmx --version` and confirming the output includes:
  ```text
  GPU support: OpenCL
  ```
* **Python Runtime:** Python 3.14+ installed on the host macOS system (needed to run the Django web server natively).

### 1.3 Linux NVIDIA GPU Profile (`cuda`)
* **Operating System:** Linux (Ubuntu 22.04 LTS or newer recommended).
* **GPU Hardware:** NVIDIA Kepler architecture or newer.
* **NVIDIA Host Driver:** Driver version must support CUDA 12.0 or higher (minimum driver version `525.60.13` or higher; verify via `nvidia-smi`).
* **NVIDIA Container Toolkit:** Installed on the host system and configured as the default container runtime.

#### Setup Instructions for NVIDIA Container Toolkit (Ubuntu/Debian)
1. Register the repository signing key and source list:
   ```bash
   curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
   curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
     sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
     sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
   ```
2. Install the package:
   ```bash
   sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit
   ```
3. Configure the container runtime integration:
   ```bash
   sudo nvidia-ctk runtime configure --runtime=docker
   ```
4. Restart the Docker daemon to apply the configuration:
   ```bash
   sudo systemctl restart docker
   ```

---

## 2. Service Management

### 2.1 Startup
To run the full multi-container application stack:
```bash
./start.sh
```
This script validates your environment, generates a local `.env` configuration file if missing, starts the required services in background mode, and opens the frontend interface in your default web browser.

### 2.2 Profile Detection and Environment Re-initialization
The detection script scans your host system for GPU drivers and hardware, then writes the optimal configuration variables to the environment files:
```bash
./install.sh
```
This writes variables to:
* `.env` (Docker Compose runtime parameters)
* `.app_state/engine-selection.env` (cached engine metadata)

> [!NOTE]
> Execute `./install.sh` again if you update host GPU drivers, install a native host GROMACS binary, or change GPU hardware.

### 2.3 Rebuilding Services
When pulling new code changes or updating dependencies, force a rebuild of the images:
```bash
# Rebuild all active services
docker compose up --build -d

# Rebuild specific services
docker compose up --build -d backend frontend
```

### 2.4 Two-Tier Image Architecture

GROWebby uses a two-tier Docker image strategy for fast deployments:

| Layer | Contents | When to rebuild |
|---|---|---|
| **Base images** (Docker Hub) | OS + tools + compiled GROMACS + pip/npm deps | Only when `requirements.txt`, `package.json`, or GROMACS version changes |
| **App images** (built locally) | Thin `FROM base + COPY code` | Every deployment — builds in seconds |

**Base image names by profile:**

| Profile | Base image |
|---|---|
| CPU (default) | `ramsainanduri/growebby-base-backend-cpu:latest` |
| CUDA | `ramsainanduri/growebby-base-backend-cuda:latest` |
| Metal/OpenCL | `ramsainanduri/growebby-base-backend-metal:latest` |
| Frontend (all profiles) | `ramsainanduri/growebby-base-frontend:latest` |

**Rebuild and push base images** (requires Docker Hub login, done rarely):
```bash
# All profiles
./build-base-images.sh --all --push

# Single profile
./build-base-images.sh --cpu --push
./build-base-images.sh --cuda --push
./build-base-images.sh --metal --push
./build-base-images.sh --frontend --push

# With a specific version tag
./build-base-images.sh --all --push --tag 1.2.0
```

**Select profile at deploy time** by setting `BACKEND_BASE_IMAGE` in `.env`:
```bash
# CPU (default — no GPU)
BACKEND_BASE_IMAGE=ramsainanduri/growebby-base-backend-cpu:latest

# NVIDIA CUDA GPU
BACKEND_BASE_IMAGE=ramsainanduri/growebby-base-backend-cuda:latest

# Apple Silicon / OpenCL GPU
BACKEND_BASE_IMAGE=ramsainanduri/growebby-base-backend-metal:latest
```

---


## 3. Operations & Diagnostics

### 3.1 API Health Monitoring
You can query the backend health check endpoint to inspect the active execution mode and GPU detection state:
```bash
curl http://127.0.0.1:8000/api/health/
```

### 3.2 Verifying GROMACS and GPU Integration
To verify that the active execution engine successfully compiles and uses GROMACS with the expected hardware backends:

```bash
# For Docker CPU execution mode:
docker compose exec backend /usr/local/gromacs/bin/gmx --version

# For Docker CUDA GPU execution mode:
docker compose exec gromacs-cuda-engine gmx --version
```
Inspect the console output to confirm the GPU support tags match your hardware capabilities (e.g. `GPU support: CUDA` or `GPU support: OpenCL`).

### 3.3 Log Monitoring
To follow the standard stdout/stderr logs of the running services:
```bash
docker compose logs -f backend
docker compose logs -f frontend
```

Simulation workflow command logs (e.g. full `gmx mdrun` streams) are written to individual files within each run workspace under `logs/` (e.g., `logs/minim-mdrun-171846435.log`). These logs can be downloaded and reviewed via the Results page in the web interface.

### 3.4 Physical Directory Structure
GROWebby uses host mounts to ensure results and coordinate files persist across container restarts.

* **Host Storage Path:** `<project-root>/.app_state/media/`
* **Run Workspaces:** `<project-root>/.app_state/media/workspaces/u<user_id>/runs/<workspace-slug>/`
* **Container Mount Locations:**
  * Backend: Mounted at `/app/media/`
  * GROMACS Compute Engines: Mounted at `/work/`

### 3.5 Run Cancellation
Simulation jobs can be safely cancelled from the web interface. When a cancellation request is issued:
1. The backend reads the active child process PID from `SimulationJob.process_pid`.
2. It sends a `SIGTERM` signal to that process group.
3. The database updates the job status to `cancelled`, leaving all generated structures and logs intact in the workspace directory for inspection.

---

## 4. Configuration Reference

The application reads configuration parameters from the `.env` file located in the project root.

| Environment Variable | Default Value | Description |
|----------------------|---------------|-------------|
| `DJANGO_DEBUG` | `0` | Enables Django debug mode (`1` for local code edits, `0` for production). |
| `GROWEBBY_SERVE_MEDIA` | `1` | Enables Django to serve run artifacts and structures directly to the browser. |
| `GROWEBBY_ENGINE` | `docker-backend-cpu` | Configures the execution engine tag (`docker-backend-cpu`, `linux-nvidia-cuda`, `mac-opencl-native`). |
| `GROMACS_EXECUTION_MODE`| `backend-gmx-2026.2` | Reported engine string in dashboard headers. |
| `GROMACS_BINARY` | `/usr/local/gromacs/bin/gmx` | Absolute file path to the `gmx` executable inside the active runner environment. |
| `GROWEBBY_ALLOW_VALIDATION_RUNS` | `0` | Set to `1` to run a synthetic demo/test mode without needing a GROMACS installation. |

---

## 5. Diagnostics & Common Failures

### 5.1 Docker Daemon Communication Failure
* **Symptom:** `Cannot connect to the Docker daemon`
* **Resolution:** Ensure the Docker service is active. Run `sudo systemctl start docker` (on Linux) or launch Docker Desktop (on macOS/Windows).

### 5.2 Port Conflicts
* **Symptom:** Address already in use error on port `5173` or `8000`.
* **Resolution:** Find the conflicting process using `lsof -i :5173` or `lsof -i :8000` and stop the running service, or configure alternative host ports in `docker-compose.yml`.

### 5.3 NVIDIA Driver and Container Version Mismatch
* **Symptom:** `unsatisfied condition: cuda>=12.0` during container creation.
* **Resolution:** 
  1. Check your host's maximum supported CUDA version by running `nvidia-smi` on the host.
  2. If your host's driver version is older than `525.60.13` (supporting up to CUDA 11.x), you must either upgrade your host's NVIDIA driver or edit the base image tag in `docker/gromacs/Dockerfile` to match your host GPU capability (e.g. `FROM nvidia/cuda:11.8.0-devel-ubuntu22.04`).

### 5.4 GROMACS Command Execution Failures
* **Symptom:** Job status changes to `FAILED` immediately upon executing a pipeline step.
* **Resolution:**
  * **PDB Parsing / Topology Failures:** `pdb2gmx` will fail if your structure has missing hydrogen atoms or nonstandard residues. Check the step log under the workspace directory (`logs/topology-pdb2gmx-*.log`). Enable the `ignh` or `ter` parameters in the configuration dropdown if required.
  * **Step Sequence Validation:** Ensure you have successfully run all preceding pipeline steps for the upload before running equilibration or production MD.

### 5.5 Verification Testing
Run unit tests for the Django apps using the local python virtual environment or through Docker:
```bash
# Running tests inside container:
docker compose exec backend python manage.py test accounts simulations

# Running tests natively:
./.venv/bin/python backend/manage.py test accounts simulations
```
