# GROWebby

> **A local, Dockerized web interface for running GROMACS molecular dynamics simulations from your browser.**

GROWebby brings a professional web UI to your local GROMACS installation. Instead of writing shell scripts or chasing MDP files across your filesystem, you upload a coordinate file, click through the pipeline stages, launch the simulation, and watch live energy and temperature charts — all from a single browser tab. Each user gets a private, isolated workspace. Admins control who gets access.

---

[![Python](https://img.shields.io/badge/Python-3.14-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Django](https://img.shields.io/badge/Django-6.0.6-092E20?logo=django&logoColor=white)](https://www.djangoproject.com/)
[![GROMACS](https://img.shields.io/badge/GROMACS-2025.4-0066CC?logoColor=white)](https://www.gromacs.org/)
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

## What is GROWebby?

GROMACS is the gold standard for biomolecular simulation, but setting up and running a full MD pipeline typically requires comfort with the Linux command line, MDP files, and careful management of intermediate outputs. GROWebby abstracts that away:

- **Upload** a `.pdb`, `.gro`, `.cif`, or `.mol2` coordinate file from the Files tab.
- **Configure** each stage of the pipeline through a guided, form-based UI — force fields, box geometry, solvation, ion concentrations, energy minimization steps, equilibration ensembles, and production runtime.
- **Launch** from any stage (skip topology if you already have it, for example).
- **Monitor** live: energy, temperature, and pressure are charted as the simulation runs. Log lines stream to the terminal viewer in real time.
- **Review** results in the 3D MolStar viewer and download trajectory/topology/log files directly from the browser.

Everything runs on your local machine inside Docker. Your data never leaves your hardware.

---

## Features at a Glance

| Feature | Details |
|---------|---------|
| 🔬 Multi-stage MD pipeline | Topology → Box → Solvation → Ions → Minimize → Equilibrate → Production |
| 🧬 3D structure viewer | Embedded MolStar viewer, dark/light mode aware |
| 📊 Live simulation metrics | Real-time energy, temperature, and pressure charts |
| 👥 Multi-user workspaces | Each user has isolated files, runs, and results |
| 🛡️ Admin approval workflow | New registrations are inactive until an admin approves them |
| 🌙 Dark / light mode | Persisted preference with full dark-mode UI compatibility |
| 🔗 URL routing | Every page has its own URL — refresh doesn't reset you |
| 📱 Responsive layout | Collapsing sidebar, mobile navigation bar |
| 🗂 Simulation history | Browse, inspect, and re-open previous runs |

---

## Quick Start

**Requirements:** Docker and Docker Compose.

### Linux / macOS

```bash
git clone https://github.com/yourorg/growebby.git
cd growebby
./install.sh   # builds images, creates admin user
./start.sh     # starts all services
```

### Windows

```bat
git clone https://github.com/yourorg/growebby.git
cd growebby
start.bat
```

Once running, open your browser:

| Service | URL |
|---------|-----|
| **Frontend** | http://localhost:5173 |
| **Backend API** | http://localhost:8000/api/ |

The default admin account is created by `install.sh`:

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `Admin` |

> ⚠️ Change the admin password immediately in any shared environment.

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
# Start all containers with live reload
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

---

## GPU Acceleration

GROWebby ships **three** GROMACS engine profiles — pick the one that matches your hardware:

| Profile | Command | Best for |
|---------|---------|----------|
| `cpu` | `docker compose --profile cpu up` | Any machine, no GPU required |
| `cuda` | `docker compose --profile cuda up` | Linux + NVIDIA GPU |
| `metal` | `docker compose --profile metal up` | macOS + Apple Silicon / AMD / Intel GPU |

```bash
# CPU only — works everywhere, including macOS Apple Silicon
docker compose --profile cpu up

# NVIDIA CUDA GPU — Linux host with NVIDIA drivers + nvidia-container-toolkit
docker compose --profile cuda up

# Apple Metal / OpenCL GPU — macOS with Apple Silicon, AMD, or Intel GPU
docker compose --profile metal up
```

### CUDA Engine (`nvidia/cuda:13.0.0-cudnn-devel-ubuntu24.04`)
- **Base image:** Ubuntu 24.04 LTS + CUDA 13.0.0 + cuDNN
- **GROMACS:** 2025.4 compiled from source with `-DGMX_GPU=CUDA` and OpenMP threading
- Requires: NVIDIA driver ≥ 570, [nvidia-container-toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/)

### Apple Metal Engine (`python:3.14-slim`)
- **Backend:** GROMACS uses OpenCL as its GPU compute layer on macOS — Apple's Metal GPU is accessed through the system OpenCL runtime automatically
- **GROMACS:** 2025.4 compiled from source with `-DGMX_GPU=OpenCL`
- Works on: Apple Silicon (M1–M4), Intel Macs with AMD or Intel Iris GPUs
- Requires: Docker Desktop for Mac with "Use Rosetta" disabled for ARM images

> On Apple Silicon, `gmx --version` will report `GPU support: OpenCL`. This is expected — Metal is the underlying hardware accelerator, OpenCL is the software API GROMACS uses to reach it.

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full version history.

---

## License

MIT — see [LICENSE](LICENSE) for details.
