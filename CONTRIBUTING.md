# Contributing to GROWebby

Thank you for your interest in contributing to GROWebby.
GROWebby is a local, Dockerised web interface for running GROMACS molecular dynamics simulations.
Contributions should prioritise correctness, traceability, scientific reproducibility, and clear documentation.

---

## Table of Contents

- [Maintainer](#maintainer)
- [Code of Conduct](#code-of-conduct)
- [Development Principles](#development-principles)
- [Project Structure](#project-structure)
- [Local Development Setup](#local-development-setup)
- [Running the Application](#running-the-application)
- [Backend Development (Django)](#backend-development-django)
- [Frontend Development (React)](#frontend-development-react)
- [GROMACS Engine Development](#gromacs-engine-development)
- [Testing](#testing)
- [Coding Standards](#coding-standards)
- [Commit Messages](#commit-messages)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Storage and Workspace Conventions](#storage-and-workspace-conventions)
- [Adding a Force Field or Water Model](#adding-a-force-field-or-water-model)
- [Adding a New API Endpoint](#adding-a-new-api-endpoint)
- [Documentation](#documentation)
- [License](#license)

---

## Maintainer

- **Ram Sai Nanduri** — GitHub: [@ramsainanduri](https://github.com/ramsainanduri)

---

## Code of Conduct

Be respectful and constructive. Scientific software contributors include researchers, students, and engineers from many backgrounds. Keep discussions technical and professional.

---

## Development Principles

1. **Scientific correctness first.** Simulation defaults must be defensible. Never change an MDP default without documenting why and citing a reference or GROMACS manual section.
2. **Auditability.** Every run writes a `run-manifest.json` and a `workflow-preview.txt`. Changes to what gets recorded in a manifest require a migration note.
3. **User data safety.** The backend never deletes workspace files unless the user explicitly requests deletion via the API. A rename operation only moves files — it never silently discards them.
4. **Per-user isolation.** All workspace paths are scoped to the user: `workspaces/u<user_id>/<slug>/`. This must not be changed without updating all path helpers in `runner.py` and `views.py`.
5. **Conservative GPU defaults.** GPU flags are only added when `gpu_execution_available()` returns `True`. Never assume GPU availability based on configuration strings alone.
6. **Approachable UI language.** Labels, error messages, and tooltips should be precise but not overwhelming to a user who is not a GROMACS expert.

---

## Project Structure

```text
GROWebby/
├── backend/                    Django API
│   ├── growebby/               Django project package (settings, URLs, wsgi, asgi)
│   ├── accounts/               User model, registration, admin approval, auth views
│   ├── simulations/            Simulation models, runner, views, API URLs
│   │   ├── models.py           UploadedCoordinate, SimulationJob, SimulationLog
│   │   ├── runner.py           Pipeline executor, MDP generator, per-user workspace helpers
│   │   ├── views.py            REST API views
│   │   └── urls.py             URL patterns for /api/
│   ├── manage.py
│   ├── requirements.txt        Django, DRF, and web dependencies
│   └── requirements-gromacs.txt  gmxapi (installed in GROMACS-enabled containers only)
│
├── frontend/                   React + TypeScript SPA
│   ├── src/
│   │   ├── App.tsx             All views and routing
│   │   ├── main.tsx            React root, theme initialisation
│   │   ├── index.css           Tailwind CSS layers and design tokens
│   │   └── styles.css          Global style overrides
│   ├── public/
│   │   └── version.json        App version metadata (read by AboutView)
│   ├── package.json
│   └── vite.config.ts
│
├── docker/
│   ├── gromacs/                Dockerfile — GROMACS 2026.2 + CUDA (NVIDIA Linux)
│   ├── gromacs-cpu/            Dockerfile — GROMACS CPU-only
│   └── gromacs-metal/          Dockerfile — GROMACS + OpenCL (Apple GPU via Metal)
│
├── docs/                       Project documentation
│   ├── simulation-workflow.md  Step reference with all GROMACS options and force fields
│   ├── architecture.md         System design and execution modes
│   ├── administration.md       Admin panel and user approval
│   ├── operations.md           Storage, cancellation, logging, plotting
│   └── user-guide.md           End-user workflow walkthrough
│
├── docker-compose.yml
├── .env.example                All supported environment variables
├── install.sh                  One-command setup script
├── start.sh / start.bat        Launch scripts
├── CHANGELOG.md
├── CONTRIBUTING.md             (this file)
└── README.md
```

---

## Local Development Setup

### Prerequisites

| Tool | Minimum version | Notes |
|------|-----------------|-------|
| Docker Desktop | 27.x | Required for backend and GROMACS containers |
| Node.js | 22.x | Frontend dev server |
| Python | 3.14 | For running backend outside Docker |
| Git | Any | |

### First-time setup

```bash
# 1. Clone the repository
git clone https://github.com/ramsainanduri/GROWebby.git
cd GROWebby

# 2. Copy the environment file
cp .env.example .env
# Edit .env if you need non-default ports or credentials

# 3. Install and start all services
./install.sh
```

`install.sh` will:
- Check for Docker
- Build all Docker images
- Run Django migrations
- Create a default admin user if none exists
- Print the local URL

### Manual setup (without install.sh)

```bash
# Build images
docker compose build

# Start services (CPU engine — works everywhere)
docker compose --profile cpu up -d

# Run migrations
docker compose exec backend python manage.py migrate

# Create admin user
docker compose exec backend python manage.py ensure_admin

# Frontend is served by Vite on http://localhost:5173
# Backend API is on http://localhost:8000
```

---

## Running the Application

```bash
# Start everything (CPU mode)
./start.sh

# Or manually
docker compose --profile cpu up

# NVIDIA CUDA GPU (Linux only)
docker compose --profile cuda up

# Apple Metal / OpenCL GPU (macOS)
docker compose --profile metal up
```

Frontend: http://localhost:5173  
Backend API: http://localhost:8000/api/  
Admin: http://localhost:8000/admin/ (Django admin)

---

## Backend Development (Django)

### Running the backend locally (outside Docker)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Useful management commands

```bash
# Create/reset default admin
python manage.py ensure_admin

# Promote an existing user to staff/superuser
python manage.py promote_admin <username>

# Check for pending migrations (CI gate)
python manage.py makemigrations --check --dry-run

# Run backend tests
python manage.py test accounts simulations
```

### Environment variables

All variables are documented in `.env.example`. Key ones for development:

| Variable | Default | Purpose |
|----------|---------|---------|
| `DJANGO_SECRET_KEY` | auto-generated | Django signing key |
| `DJANGO_DEBUG` | `1` | Enable debug mode |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1` | Allowed hostnames |
| `GROMACS_BINARY` | `/usr/local/gromacs/bin/gmx` | Path to `gmx` executable |
| `GROMACS_EXECUTION_MODE` | `backend-gmx-2026.2` | Mode string reported to frontend |
| `GROWEBBY_ENGINE` | unset | Optional engine tag |
| `GROWEBBY_ALLOW_VALIDATION_RUNS` | `0` | Set to `1` to enable synthetic demo runs |

### Adding a database migration

```bash
docker compose exec backend python manage.py makemigrations
docker compose exec backend python manage.py migrate
```

Always review the generated migration file before committing it. Migration files are version-controlled.

---

## Frontend Development (React)

### Running the frontend locally

The Vite dev server runs inside Docker by default. To run it natively:

```bash
cd frontend
npm install
npm run dev
```

The frontend expects the backend API at `http://localhost:8000`. This is configured in `vite.config.ts` as a proxy.

### Useful commands

```bash
# Type check
npx tsc --noEmit

# Build production bundle (check for compile errors)
npm run build

# Preview production build
npm run preview
```

### Frontend conventions

- **All views live in `App.tsx`** — the file is intentionally monolithic for this stage of the project. Extract to separate files only when a view exceeds ~400 lines.
- **Icons**: use `lucide-react` only. Do not add icon libraries. Pick the most semantically accurate icon; avoid reusing the same icon for unrelated actions.
- **Dark mode**: every new UI element must work in both `dark` and `light` modes. Test by toggling the theme button.
- **Routing**: all pages have a URL. Add new pages to the `<Routes>` block in `App.tsx` and add a `<Link>` in the sidebar.
- **API calls**: add new API calls to the inline `api` object (search for `const api =` in `App.tsx`) or a companion `lib/api.ts` file.
- **GROMACS options dropdowns**: call `GET /api/gromacs-options/` and populate from the response. Do not hardcode force fields or water models in the UI.

### version.json

When adding a new dependency or upgrading a version, update `frontend/public/version.json` to keep the About page accurate.

---

## GROMACS Engine Development

### Dockerfile locations

| Profile | Dockerfile | GPU |
|---------|------------|-----|
| `cpu` | `docker/gromacs-cpu/Dockerfile` | None |
| `cuda` | `docker/gromacs/Dockerfile` | NVIDIA CUDA |
| `metal` | `docker/gromacs-metal/Dockerfile` | Apple OpenCL → Metal |

### Building a single engine image

```bash
docker build -t growebby-gromacs-cpu ./docker/gromacs-cpu
docker build -t growebby-gromacs-cuda ./docker/gromacs
docker build -t growebby-gromacs-metal ./docker/gromacs-metal
```

### Upgrading GROMACS version

1. Update the tarball URL in the `RUN curl` line of the relevant Dockerfile.
2. Update `GROMACS_EXECUTION_MODE` in `docker-compose.yml`.
3. Update `frontend/public/version.json`.
4. Update the GROMACS badge in `README.md`.
5. Add an entry to `CHANGELOG.md`.

---

## Testing

### Backend tests

```bash
# All tests
docker compose exec backend python manage.py test

# Specific apps
docker compose exec backend python manage.py test accounts
docker compose exec backend python manage.py test simulations

# Outside Docker
cd backend && python manage.py test
```

### Frontend type check and build

```bash
cd frontend
npx tsc --noEmit   # type check
npm run build      # full bundle
```

### What to test when contributing

| Change area | What to verify |
|-------------|----------------|
| New model field | Migration generated and applied cleanly |
| Auth / permissions | Unauthenticated, regular user, and staff user cases |
| Workspace paths | Per-user prefix `u<id>/` is preserved |
| Artifact URLs | URL uses `user_dir_for_job()` + `workspace_slug` |
| Force field / water model | Appears in `/api/gromacs-options/` response |
| MDP option | Written correctly in the generated `.mdp` file |
| mdrun flags | Correct flags in `step_commands()` output |
| New UI page | Page accessible at a unique URL, dark mode works |

---

## Coding Standards

### Python

- Python 3.14+
- Follow [PEP 8](https://peps.python.org/pep-0008/)
- Type annotations on all function signatures
- Keep functions short and single-purpose
- No bare `except:` clauses — always catch a specific exception type
- Use `pathlib.Path` for all file operations — never `os.path.join`

### TypeScript / React

- TypeScript strict mode (configured in `tsconfig.json`)
- No `any` types
- Functional components only — no class components
- Props typed with explicit interfaces
- No inline `style={{}}` on elements — use Tailwind classes

### SQL / Django ORM

- Never call `.save()` on a model when only specific fields changed — use `update_fields=[...]`
- Use `select_related()` when the view serialises related objects
- Do not put business logic in model methods — keep it in `runner.py` or `views.py`

---

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

[optional body]
[optional footer]
```

### Types

| Type | Use for |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `chore` | Build, config, dependencies |
| `refactor` | Code restructuring (no behavior change) |
| `test` | Tests only |
| `perf` | Performance improvement |

### Scopes

`runner`, `views`, `models`, `accounts`, `frontend`, `docker`, `api`, `docs`, `settings`

### Examples

```
feat(runner): add L-BFGS minimiser support with lbfgsInitStep parameter
fix(views): use user_dir_for_job() when resolving workspace paths in PATCH
docs(simulation-workflow): add all GROMACS 2026.2 force fields and water models
chore(docker): upgrade CUDA base to nvidia/cuda:13.0.0-cudnn-devel-ubuntu24.04
```

---

## Pull Request Guidelines

1. **Branch** off `dev` — never commit directly to `main` or `dev`.
2. **Keep PRs focused.** One logical change per PR. Large PRs are hard to review correctly.
3. **Title** follows Conventional Commits format.
4. **Description** should explain:
   - What changed and why
   - Which workflow steps or API endpoints are affected
   - Migration notes if DB schema changed
   - Storage or path changes if workspace layout changed
   - How to manually verify the change
5. **Checklist before opening a PR:**

```bash
# Backend
docker compose exec backend python manage.py makemigrations --check --dry-run
docker compose exec backend python manage.py test accounts simulations

# Frontend
cd frontend && npx tsc --noEmit && npm run build

# Git
git status   # working tree clean
git log --oneline -5  # review your commits
```

---

## Storage and Workspace Conventions

> **Critical.** Do not change workspace path logic without reading this section.

### Per-user workspace layout

```text
<MEDIA_ROOT>/workspaces/u<user_id>/runs/<workspace_slug>/
<MEDIA_ROOT>/workspaces/u<user_id>/uploads/<filename>
```

- `u<user_id>` is derived from `user_dir_for_job(job)` in `runner.py`
- Anonymous jobs use `u0`
- `workspace_slug` is `run-<job_id>-<slugified-run-name>`
- All jobs within a run group share the same `workspace_slug`

### Functions that must use `user_dir_for_job()`

| File | Function | Purpose |
|------|----------|---------|
| `runner.py` | `run_workspace()` | Resolve workspace `Path` |
| `runner.py` | `workspace_media_url()` | Build artifact URLs |
| `runner.py` | `import_previous_step_workspace()` | Copy files between steps |
| `views.py` | `artifact_relative_path()` | Parse artifact URLs |
| `views.py` | `artifact_file_path()` | Resolve artifact `Path` |
| `views.py` | `simulation_detail()` (PATCH) | Rename workspace directory |
| `views.py` | `simulation_detail()` (DELETE) | Remove workspace directory |
| `models.py` | `user_upload_path()` | Resolve upload path |

If you add any new file-path resolution, it must go through `user_dir_for_job()`.

### Media URL format

Artifact URLs stored in `job.parameters["artifactFiles"]` follow:

```text
/media/workspaces/u<user_id>/runs/<workspace_slug>/<relative-path>
```

Django's `MEDIA_URL` prefix is `/media/` by default.

---

## Adding a Force Field or Water Model

1. Open `backend/simulations/runner.py`.
2. Add an entry to `FORCE_FIELDS` or `WATER_MODELS` at the appropriate position in the list.
3. Format: `("ff_dir_name", "Display Label", "Category")`
4. Verify the directory name matches what GROMACS ships under `share/gromacs/top/`.
5. The `/api/gromacs-options/` endpoint will automatically return the new entry.
6. Add a row to the force field or water model table in `docs/simulation-workflow.md`.

---

## Adding a New API Endpoint

1. Write the view function in `backend/simulations/views.py` or `backend/accounts/views.py`.
2. Add a `path(...)` entry in the corresponding `urls.py`.
3. Decorate with `@require_GET`, `@require_POST`, or `@require_http_methods([...])`.
4. Handle authentication: check `request.user.is_authenticated` and `request.user.is_staff` as appropriate.
5. Return `JsonResponse` — never `HttpResponse` with raw text.
6. Add a test case in the relevant `tests.py`.
7. Document the endpoint in `docs/architecture.md` or `docs/operations.md`.

---

## Documentation

All documentation lives in `docs/`. Update the relevant file when you change behaviour:

| Doc file | Update when |
|----------|-------------|
| `docs/simulation-workflow.md` | Adding/changing simulation steps, force fields, water models, MDP options, GROMACS flags |
| `docs/architecture.md` | Changing execution modes, storage layout, service structure, background execution |
| `docs/administration.md` | Changing user approval flow, admin APIs, role system |
| `docs/operations.md` | Changing cancellation, logging, metric extraction, artifact management |
| `docs/user-guide.md` | Changing the UI workflow, page navigation, file upload |

Always update `CHANGELOG.md` under `[Unreleased]` before merging a meaningful change.

---

## License

By contributing, you agree that your contributions are provided under the [MIT License](LICENSE).
