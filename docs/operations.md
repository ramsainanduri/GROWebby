# Operations and Troubleshooting

This document covers startup, health checks, execution engines, and common failures.

## Start

From the project root:

```bash
./start.sh
```

The script creates `.env` if needed, starts services, and opens the frontend.

## Install or Re-detect Engine

Run:

```bash
./install.sh
```

This writes:

```text
.env
.app_state/engine-selection.env
```

Re-run it after installing native GROMACS or changing hardware/engine configuration.

## Health Check

Use:

```bash
curl http://127.0.0.1:8000/api/health/
```

Example Docker CPU response:

```json
{
  "status": "ok",
  "service": "growebby-backend",
  "engine": {
    "selected": "docker-backend-cpu",
    "executionMode": "backend-gmx-2026.2",
    "gromacsBinary": "/usr/local/gromacs/bin/gmx",
    "gpuAvailable": false,
    "gpuBackend": "none"
  }
}
```

## Verify GROMACS

Docker backend CPU:

```bash
docker compose exec backend /usr/local/gromacs/bin/gmx --version
```

Native macOS GROMACS:

```bash
gmx --version
```

For Apple Silicon GPU execution, confirm:

```text
GPU support: OpenCL
```

## Logs

Docker service logs:

```bash
docker compose logs -f backend
docker compose logs -f frontend
```

Run events are visible in the Results page and stored in the database through simulation log records. The UI log window is intentionally clean: it shows stage starts, completed commands, status changes, and readable failure summaries.

Full GROMACS stdout/stderr is captured separately for each command and written into the run workspace under `logs/`. These files are listed in Run Files on the Results page. If a command fails, GROWebby also shows the final verbose error tail in the UI so the problem is visible without opening the full file.

Simulation plots update while `mdrun` is active. During long runs, GROWebby publishes lightweight live progress points first and replaces them with extracted GROMACS energy data after `.edr` frames become readable.

## Cancelling Runs

Use Cancel run on the Results page for queued or running jobs. While a GROMACS command is active, the backend stores the child process PID in the database and sends `SIGTERM` to that process group when cancellation is requested.

Cancellation changes the job status to `cancelled`, clears the stored PID, records a clean event log entry, and leaves any files produced so far in the run workspace for inspection.

## Environment File

Create a local `.env` from the example file:

```bash
cp .env.example .env
```

Key settings:

```text
DJANGO_DEBUG=0
GROWEBBY_SERVE_MEDIA=1
GROWEBBY_ENGINE=docker-backend-cpu
GROMACS_EXECUTION_MODE=backend-gmx-2026.2
GROMACS_BINARY=/usr/local/gromacs/bin/gmx
GROWEBBY_ALLOW_DEMO_RUNS=0
```

Use `DJANGO_DEBUG=1` only for backend development. `GROWEBBY_SERVE_MEDIA=1` keeps local run artifacts available through the browser while debug mode is off. Keep `GROWEBBY_ALLOW_DEMO_RUNS=0` for real GROMACS execution.

## Common Startup Issues

### Docker is not running

Symptom:

```text
Cannot connect to the Docker daemon
```

Fix: start Docker Desktop or Docker Engine, then run `./start.sh` again.

### Port already in use

Frontend uses port `5173`. Backend uses port `8000`.

Find the process:

```bash
lsof -i :5173
lsof -i :8000
```

Stop the conflicting process or change the Compose ports.

### Login returns HTML instead of JSON

Symptom:

```text
Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

Usually the frontend is calling the wrong backend URL or the backend is not ready.

Check:

```bash
curl http://127.0.0.1:8000/api/health/
```

Then restart:

```bash
docker compose up -d --build backend frontend
```

## Common Simulation Issues

### GPU requested but CPU engine active

If `gpuAvailable` is false, GROWebby does not send GPU flags. If a stale request includes GPU, the runner logs the issue and runs on CPU.

Check:

```bash
curl http://127.0.0.1:8000/api/health/
```

### Later step cannot run

A step such as NPT or production requires output from previous steps. Complete the previous step first for the same upload, or run the complete pipeline.

### `pdb2gmx` fails

Common causes:

- Unknown residue names.
- Atom naming mismatch.
- Missing atoms.
- Unsupported ligands.
- Interactive termini choices.

Inspect the run log and the uploaded structure. Ligands and nonstandard residues often need separate parameterization.

### Run finishes too quickly

Check the execution mode in Results.

- `development-fallback`: synthetic demo mode only, not real MD.
- `backend-gmx-2026.2`: real GROMACS in Docker CPU mode.
- `native-opencl`: native macOS GROMACS OpenCL mode.

The current default path should be real GROMACS unless `GROWEBBY_ALLOW_DEMO_RUNS=1` is explicitly set.

## Rebuild

Rebuild all active services:

```bash
docker compose up --build -d
```

Rebuild only backend and frontend:

```bash
docker compose up --build -d backend frontend
```

## Test

Backend tests:

```bash
./.venv/bin/python backend/manage.py test accounts simulations
```

Frontend build:

```bash
cd frontend
npm run build
```
