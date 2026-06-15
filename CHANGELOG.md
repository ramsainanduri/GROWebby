# Changelog

All notable changes to GROWebby are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.0]

### Added
- Two-tier Docker image architecture: tool-only base images (pushed to Docker Hub once) plus thin app-layer images (built locally in seconds on every deploy).
- `docker/base-backend-cpu/Dockerfile` — Python 3.14 + GROMACS 2026.2 CPU + pip deps, no app code.
- `docker/base-backend-cuda/Dockerfile` — CUDA 12.1.1 + GROMACS 2026.2 GPU + pip deps, no app code.
- `docker/base-backend-metal/Dockerfile` — Python 3.14 + OpenCL + GROMACS 2026.2 OpenCL + pip deps, no app code.
- `docker/base-frontend/Dockerfile` — Node 22 + baked-in `node_modules`, no app code.
- `build-base-images.sh` — helper script to build and optionally push all base images with `--cpu`, `--cuda`, `--metal`, `--frontend`, `--all`, `--push`, and `--tag` flags.

### Changed
- `backend/Dockerfile` reduced to `FROM ${BASE_IMAGE} + COPY .` — no more GROMACS compilation on every code change.
- `frontend/Dockerfile` reduced to `FROM growebby-base-frontend + COPY .`.
- `docker-compose.yml` now accepts `BACKEND_BASE_IMAGE` build arg to select the correct profile-specific base at compose-up time.
- `docs/operations.md` updated with full two-tier image documentation and `BACKEND_BASE_IMAGE` configuration reference.

## [1.1.0]


### Added
- Designed and integrated a scalable SVG vector logo (isometric simulation box) across the application interface and as the native favicon.
- Added a new backend API endpoint `/api/gromacs-options/` to dynamically expose engine-supported parameters.
- Rebuilt Admin UI natively in the frontend for managing users without relying on the Django Admin panel.
- In-app CRUD capabilities to create users, toggle admin privileges, and reset passwords.
- Auto-assignment of new users to `admin` or `user` Django groups based on status via signals.
- Email notifications triggered upon new registration, admin approval, and simulation completion (success/fail/cancel).

### Changed
- Re-architected CUDA execution environment: downgraded base to CUDA 12.0.1 for broad host driver compatibility.
- GROMACS configuration menus in the Workflow UI are now dynamically populated from the backend engine instead of using hardcoded lists.
- Updated documentation with clear guidelines for managing fine-grained group permissions via the standard Django Admin interface.
- Professionalized application documentation and removed informal system logs.
- Consolidated hardware engine profiling and error recovery for container environments.
- Restored frontend utility and API abstractions after UI component decoupling.
- Fixed Tailwind v4 initialization by removing deprecated PostCSS configuration.
- Updated repository structure to ensure essential source directories are properly tracked.

## [1.0.0]


### Added

#### Core Application
- Full GROMACS molecular dynamics workflow management via a web UI
- Multi-step pipeline: Topology → Box → Solvation → Ions → Minimize → Equilibrate → Production
- Per-user isolated workspace (files, runs, results)
- Real-time simulation progress monitoring with live log streaming
- Energy, temperature, and pressure metric charts (Recharts)
- 3D molecular structure viewer powered by **MolStar** (PDBe)

#### Authentication & User Management
- Session-based authentication with Django (CSRF-protected)
- **Admin approval workflow**: new registrations are inactive until an admin approves them
- `purpose` field on registration so admins understand who is requesting access
- Admin panel: view all users, approve pending registrations, deny/remove users
- Role display (Superuser / Staff / User) in admin table

#### Frontend
- React 19 SPA with TypeScript
- URL-based routing via **react-router-dom** (browser refresh preserves your page)
- Dark / light mode with `localStorage` persistence and system preference fallback
- Fully dark-mode-compatible UI — icons, selections, tables, status badges
- Distinct **Lucide** icons per navigation item and workflow step
- Improved selection highlight colours for both light and dark modes
- Professional login page with split-pane poster layout and animated gradient
- About page showing app version and tool versions (fetched from `version.json`)
- Sidebar collapses to icon-only mode on smaller viewports

#### Backend (Django)
- REST API for uploads, simulations, logs, and auth
- `UserProfile` model storing user `purpose` and creation timestamp
- Admin-only API endpoints: list users, approve, deny
- Log streaming via Server-Sent Events

#### Infrastructure
- Docker Compose setup: frontend (Vite dev server), backend (Django), worker
- `install.sh` / `start.sh` / `start.bat` helper scripts
- `version.json` in `public/` for client-side version display

#### Documentation
- `README.md` with quick start, badges, and architecture overview
- `CHANGELOG.md` (this file)

