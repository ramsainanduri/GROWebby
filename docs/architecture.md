# Architecture

GROWebby is split into a React frontend, Django backend, and GROMACS execution layer.

## Components

| Component | Technology | Responsibility |
|-----------|------------|----------------|
| Frontend | React, Vite, TypeScript | UI, routing, workflow configuration, molecule viewer, plots |
| Backend | Django | Authentication, uploads, jobs, logs, artifacts, run orchestration |
| Execution engine | GROMACS 2026.2 | Topology, preparation, minimization, equilibration, production MD |
| Storage | Django database and media workspace | Uploaded files, run metadata, artifacts, logs |

## Database

The current local database is SQLite, stored at:

```text
backend/db.sqlite3
```

The database stores:

- Users, admin flags, groups, and approval state.
- Uploaded coordinate metadata and ownership.
- Simulation jobs, statuses, current step, progress, run names, run groups, and workspace slugs.
- Active GROMACS child process PID while a command is running.
- Metrics used by the dashboard and plots.
- Clean event logs shown in the UI.
- Artifact metadata, including file name, kind, relative path, and browser URL.

Large binary and text artifacts are not stored in SQLite. They are stored under `.app_state/media/`, including uploads, generated configs, structures, trajectories, `.edr` files, `.xvg` analysis files, and full GROMACS command logs.

## Service Layout

Docker Compose defines:

- `backend`: Django API and GROMACS CPU binary in the default Docker execution path.
- `frontend`: Vite development server for the React UI.
- `gromacs-cpu-engine`: CPU engine image for standalone engine work.
- `gromacs-cuda-engine`: CUDA engine image for Linux NVIDIA hosts.
- `gromacs-metal-engine`: experimental OpenCL-oriented image, not the active Apple Silicon path.

The default active path on Apple Silicon without native GROMACS is `docker-backend-cpu`.

## Request Flow

1. User signs in through the React UI.
2. Frontend calls Django API endpoints with session cookies.
3. User uploads a coordinate file.
4. Backend stores the upload and records ownership.
5. User creates a simulation job.
6. Backend starts a runner thread.
7. Runner prepares a per-run workspace.
8. Runner executes GROMACS commands and stores the active child PID while each command runs.
9. Backend stores logs, progress, metrics, cancellation state, and artifact metadata.
10. Frontend polls job state and streams logs.

## Workspace Layout

Run files are stored under:

```text
<project-root>/.app_state/media/workspaces/u<user_id>/<run-workspace-slug>/
```

Docker mounts the same host directory into the backend container at:

```text
/app/media/workspaces/u<user_id>/<run-workspace-slug>/
```

Standalone GROMACS engine containers mount the same host directory at:

```text
/work/workspaces/u<user_id>/<run-workspace-slug>/
```

The `u<user_id>` prefix comes from `user_dir_for_job()` in `runner.py`. Anonymous runs use `u0`. This prevents run name collisions between users.

Typical contents:

```text
input.pdb
topol.top
ions.mdp
minim.mdp
nvt.mdp
npt.mdp
production.mdp
workflow-preview.txt
run-manifest.json
outputs/
analysis/
*.tpr
*.gro
*.cpt
*.edr
logs/
*.log
```

Each run has its own workspace. Renaming a run renames the workspace folder and updates artifact URLs.

## Execution Modes

### Docker Backend CPU

Current default when no native Apple OpenCL `gmx` is available.

```text
GROWEBBY_ENGINE=docker-backend-cpu
GROMACS_EXECUTION_MODE=backend-gmx-2026.2
GROMACS_BINARY=/usr/local/gromacs/bin/gmx
```

This mode runs real GROMACS 2026.2 inside the backend container. GPU support is disabled.

### Native Apple OpenCL

Used for Apple Silicon GPU execution when a native macOS GROMACS binary is installed and reports:

```text
GPU support: OpenCL
```

In this mode:

- Frontend still runs through Docker.
- Backend runs directly on macOS.
- The runner calls the native host `gmx`.

This is required because Docker Desktop Linux containers cannot expose the Apple GPU as a macOS OpenCL device.

### Linux NVIDIA CUDA

Used on Linux hosts with NVIDIA drivers and NVIDIA Container Toolkit. This path uses the CUDA GROMACS image.

## GPU Source of Truth

The backend health endpoint reports:

```text
/api/health/
```

Relevant fields:

- `engine.selected`
- `engine.executionMode`
- `engine.gromacsBinary`
- `engine.gpuAvailable`
- `engine.gpuBackend`

The runner only adds GPU command flags when the active engine reports GPU support. The UI uses the same health data to enable or disable GPU controls.

## Background Execution

Simulation jobs currently run in backend-managed threads. While a GROMACS command is active, the runner stores the child process PID in the `SimulationJob.process_pid` field. The cancel endpoint uses that PID to send `SIGTERM` to the process group, then marks the job as `cancelled` and clears the PID.

This is simple and works for local execution. For multi-user or long-running production deployments, the recommended future architecture is:

- Persistent database service.
- Task queue such as Celery or Dramatiq.
- Worker service per execution engine.
- Structured artifact indexing.
- Retry controls and richer worker supervision.
