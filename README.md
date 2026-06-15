[![Python](https://img.shields.io/badge/Python-3.14-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Django](https://img.shields.io/badge/Django-6.0.6-092E20?logo=django&logoColor=white)](https://www.djangoproject.com/)
[![GROMACS](https://img.shields.io/badge/GROMACS-2026.2-0066CC?logoColor=white)](https://www.gromacs.org/)
[![gmxapi](https://img.shields.io/badge/gmxapi-0.4.x-0066CC)](https://gmxapi.org/)
[![React](https://img.shields.io/badge/React-19.2.7-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.0.16-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22.22.3-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![MolStar](https://img.shields.io/badge/MolStar-3.12.0-7C3AED)](https://molstar.org/)
[![CUDA](https://img.shields.io/badge/GPU-CUDA_13.0-76B900?logo=nvidia&logoColor=white)](https://developer.nvidia.com/cuda-toolkit)
[![Apple Metal](https://img.shields.io/badge/GPU-Apple_Metal_(OpenCL)-000000?logo=apple&logoColor=white)](https://developer.apple.com/metal/)
[![Ubuntu](https://img.shields.io/badge/Ubuntu-24.04_LTS-E95420?logo=ubuntu&logoColor=white)](https://ubuntu.com/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-4.x-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Docker](https://img.shields.io/badge/Docker-27.x-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-22C55E)](LICENSE)

---

# GROWebby

> **A local, Dockerized web interface for GROMACS molecular dynamics workflows.**

GROWebby provides a web interface for local GROMACS installations. Users upload a coordinate file, configure pipeline stages, launch simulations, inspect intermediate files, and review live metrics from a single browser session. Each user has an isolated workspace, and administrators control access.

---

## What is GROWebby?

GROMACS is widely used for biomolecular simulation, but setting up and running a full MD pipeline requires command-line work, MDP file management, and careful handling of intermediate outputs. GROWebby provides a structured interface for these tasks:

- **Upload** a `.pdb`, `.gro`, `.cif`, or `.mol2` coordinate file from the Files tab.
- **Configure** each stage of the pipeline through a guided, form-based UI: force fields, box geometry, solvation, ion concentrations, energy minimization, NVT, NPT, and production runtime.
- **Launch** one step at a time or run the complete pipeline. Step runs check for the required previous output.
- **Monitor** live: energy, temperature, and pressure are charted as the simulation runs. Clean run events stream to the log viewer in real time, with full GROMACS command logs stored as files.
- **Review** results in the 3D MolStar viewer and download trajectory/topology/log files directly from the browser.

Everything runs on your local machine inside Docker. Your data never leaves your hardware.

---

## Features at a Glance

| Feature | Details |
|---------|---------|
| Multi-stage MD pipeline | Topology -> Box -> Solvation -> Ions -> Minimize -> NVT -> NPT -> Production |
| 3D structure viewer | Embedded MolStar viewer, dark/light mode aware |
| Live simulation metrics | Real-time energy, temperature, and pressure charts |
| Multi-user workspaces | Each user has isolated files, runs, and results |
| Admin approval workflow | New registrations are inactive until an admin approves them |
| Dark / light mode | Persisted preference with full dark-mode UI compatibility |
| URL routing | Every page has its own URL and can be refreshed directly |
| Responsive layout | Collapsing sidebar and mobile navigation |
| Simulation history | Browse, inspect, and re-open previous runs |
| Run cancellation | Active GROMACS child process PID is stored and can be terminated from the Results page |

---

## Storage and Database

GROWebby currently uses Django's default SQLite database at `backend/db.sqlite3`. The database stores users, groups, uploaded-file records, simulation jobs, run status, current step, progress, metrics, clean event logs, artifact metadata, run grouping, workspace names, and the active GROMACS process PID while a command is running.

Large files are stored on disk under `.app_state/media/`, not inside the database. This includes uploaded structures, generated MDP files, GROMACS outputs, trajectories, energy files, and full command logs.

For Docker-based runs, the physical host storage path is:

```text
<project-root>/.app_state/media/workspaces/<run-workspace-slug>/
```

The same host directory is mounted in the backend container as `/app/media/workspaces` and in GROMACS engine containers as `/work/workspaces`.

---

## Quick Start

**Requirements:** Docker and Docker Compose.

### Linux / macOS

```bash
git clone <repository-url>
cd growebby
./install.sh   # detects the execution engine and writes .env
./start.sh     # starts all services
```

### Windows

```bat
git clone <repository-url>
cd growebby
start.bat
```

Once running, open your browser:

| Service | URL |
|---------|-----|
| **Frontend** | http://localhost:5173 |
| **Backend API** | http://localhost:8000/api/ |

Create the first admin account after startup:

```bash
docker compose exec backend python manage.py ensure_admin \
  --username admin \
  --email admin@example.com \
  --password "change-this-password"
```

The password must be at least 8 characters. Change admin credentials immediately in any shared environment.

---

## Documentation

Full documentation is available in [`docs/`](docs/README.md):

- [User Guide](docs/user-guide.md)
- [Simulation Workflow Reference](docs/simulation-workflow.md)
- [Administration and Access Control](docs/administration.md)
- [Architecture](docs/architecture.md)
- [Operations and Troubleshooting](docs/operations.md)
- [Contributing](CONTRIBUTING.md)

---

## User Registration & Approval

GROWebby uses a moderated sign-up flow to prevent unauthorized access:

1. A new user fills in their **username**, **email**, **password**, and a **purpose** (why they need access).
2. The account is created as **inactive** — the user cannot sign in yet.
3. The admin opens the **Admin Panel** (`/admin`) and sees the pending request with the stated purpose.
4. The admin clicks **Approve** or **Deny**.
5. The approved user can now sign in normally.

---

## Architecture

```
growebby/
├── frontend/               # Vite + React 19 + TypeScript + Tailwind CSS
│   ├── src/
│   │   ├── App.tsx         # Application shell, routing, all page views
│   │   ├── lib/api.ts      # Typed API client (fetch + CSRF)
│   │   └── components/
│   │       ├── Viewer3D.tsx      # MolStar 3D viewer wrapper
│   │       └── ThemeToggle.tsx   # Dark / light mode toggle
│   └── public/
│       └── version.json    # App & tool version data (shown on About page)
│
├── backend/                # Django 6 REST API
│   ├── accounts/           # Auth, user profiles, admin approval endpoints
│   │   ├── models.py       # UserProfile (OneToOne → User, purpose field)
│   │   ├── views.py        # Login, register, session, admin CRUD
│   │   └── urls.py         # /auth/* routes
│   └── simulations/        # Job queue, file uploads, log streaming
│
├── docker/
│   ├── gromacs/            # GROMACS + CUDA image (requires NVIDIA GPU)
│   └── gromacs-cpu/        # GROMACS CPU-only image
│
└── docker-compose.yml      # Orchestrates frontend, backend, and engine
```

---

## Development

```bash
# Create local environment configuration once
cp .env.example .env

# Start the application
docker compose up

# Apply Django database migrations
docker exec growebby-backend-1 python manage.py migrate

# Create a superuser manually
docker exec -it growebby-backend-1 python manage.py createsuperuser

# Run backend tests
docker exec growebby-backend-1 python manage.py test

# Run frontend type-check + build
docker exec growebby-frontend-1 npm run build
```

## Environment Configuration

GROWebby reads runtime configuration from `.env`. The repository includes `.env.example` with safe defaults for normal local runs.

Important settings:

- `DJANGO_DEBUG=0` is the normal setting. Use `DJANGO_DEBUG=1` only while developing the backend.
- `GROWEBBY_SERVE_MEDIA=1` lets the local backend serve uploaded files and run artifacts even when debug mode is off.
- `GROWEBBY_ENGINE=docker-backend-cpu` runs GROMACS 2026.2 inside Docker with CPU/OpenMP support.
- `GROMACS_EXECUTION_MODE=backend-gmx-2026.2` is shown in health checks and run metadata.
- `GROMACS_BINARY=/usr/local/gromacs/bin/gmx` is the backend container path.
- `GROWEBBY_ALLOW_VALIDATION_RUNS=0` keeps runs on the real GROMACS path. Set it to `1` only for interface validation without a GROMACS executable.

`docker-compose.yml` uses these values through environment interpolation, so debug mode is controlled by `.env`, not hardcoded in Compose.

## Logs and Live Plots

The Results page shows clean run events in the log window. Full GROMACS command output is saved as per-run files under `logs/` and listed in Run Files. When a command fails, the UI shows a readable failure summary and the final error tail, while the complete verbose output remains available as a downloadable log artifact.

Live plots update while `mdrun` is active. GROWebby first publishes lightweight live progress points, then replaces them with extracted GROMACS energy data from `.edr`/`.xvg` files as soon as GROMACS flushes readable energy frames.

---

## GPU Acceleration

GROWebby supports real GROMACS execution on CPU Docker engines and native GPU execution where the host can expose the GPU to GROMACS.

| Profile | Command | Best for |
|---------|---------|----------|
| `docker-backend-cpu` | `./start.sh` | macOS Apple Silicon without native GROMACS, or any machine with Docker CPU execution |
| `mac-opencl-native` | `./install.sh && ./start.sh` | Apple Silicon GPU through a native macOS GROMACS OpenCL build |
| `cuda` | `docker compose --profile cuda up` | Linux + NVIDIA GPU |

```bash
# CPU Docker backend — works everywhere, including macOS Apple Silicon
./start.sh

# Apple Silicon GPU — requires native macOS GROMACS with OpenCL support
./install.sh
./start.sh
```

### Apple Silicon GPU

Apple M-series GPUs are not CUDA devices. GROMACS uses the macOS OpenCL backend for Apple Silicon GPU acceleration. Docker Desktop runs Linux containers and does not expose the Apple GPU as a macOS OpenCL device, so GROWebby runs this profile with:

- Frontend in Docker
- Django backend directly on macOS
- Native `gmx` from the host, usually `/opt/homebrew/bin/gmx`

Run `gmx --version` and confirm:

```text
GPU support: OpenCL
```

If that line is not present, `./install.sh` selects the Docker CPU backend so runs still execute correctly.

### CUDA Engine (`nvidia/cuda:13.0.0-cudnn-devel-ubuntu24.04`)
- **Base image:** Ubuntu 24.04 LTS + CUDA 13.0.0 + cuDNN
- **GROMACS:** 2026.2 compiled from source with `-DGMX_GPU=CUDA` and OpenMP threading
- Requires: NVIDIA driver >= 570, [nvidia-container-toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/)

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full version history.

---

## License

MIT — see [LICENSE](LICENSE) for details.

## Maintainer

Ram Sai Nanduri (GitHub: [@ramsainanduri](https://github.com/ramsainanduri)).
