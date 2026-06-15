# GROWebby Documentation

This folder contains the operating and user documentation for GROWebby.

## Start Here

- [User Guide](user-guide.md): everyday use of the application.
- [Simulation Workflow Reference](simulation-workflow.md): what each MD step does, what files it expects, and what it produces.
- [Administration and Access Control](administration.md): accounts, approvals, groups, and admin operations.
- [Architecture](architecture.md): application services, data flow, execution engines, and storage layout.
- [Operations and Troubleshooting](operations.md): startup, health checks, GPU modes, logs, and common failures.
- [Contributing](../CONTRIBUTING.md): development standards, checks, and pull request guidance.

## Current Execution Model

GROWebby runs the browser UI and Django API locally. Simulations are executed by GROMACS through the backend runner. On this machine the active engine is currently:

```text
GROWEBBY_ENGINE=docker-backend-cpu
GROMACS_EXECUTION_MODE=backend-gmx-2026.2
GROMACS_BINARY=/usr/local/gromacs/bin/gmx
```

That means runs execute real GROMACS 2026.2 inside the backend Docker container, with CPU/OpenMP support. Apple Silicon GPU execution requires a native macOS GROMACS build that reports `GPU support: OpenCL`.

## Current Storage

GROWebby currently uses SQLite at `backend/db.sqlite3` for users, uploads, simulation jobs, status, metrics, event logs, artifact metadata, run grouping, and the active process PID used for cancellation.

Run files are stored on the host under:

```text
<project-root>/.app_state/media/workspaces/<run-workspace-slug>/
```

Docker mounts the same storage into the backend at `/app/media/workspaces` and into GROMACS engine containers at `/work/workspaces`.
