# Changelog

All notable changes to GROWebby are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-06-15

### Added

#### Core Application
- Full GROMACS molecular dynamics workflow management via a web UI
- Multi-step pipeline: Topology → Box → Solvation → Ions → Minimize → Equilibrate → Production
- Per-user isolated workspace (files, runs, results)
- Real-time simulation progress monitoring with live log streaming
- Energy, temperature, and pressure metric charts (Recharts)
- 3D molecular structure viewer powered by **MolStar** 3.12.0 (PDBe)
- CUDA GPU engine built on **GROMACS 2025.4** + `nvidia/cuda:13.0.0-cudnn-devel-ubuntu24.04`

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

---

## [Unreleased]

### Planned
- Real GROMACS execution dispatch in Docker worker container
- GPU selection UI (CUDA vs OpenCL)
- Cancellation controls for running simulations
- Artifact download with trajectory viewer
- Email notification on admin approval
