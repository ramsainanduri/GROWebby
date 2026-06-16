# Changelog

All notable changes to GROWebby are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0]

### Added
- **In-App PDB Editor**: Full-screen Monaco-powered editor to manually review and fix crystal structures prior to simulation.
- **Advanced GROMACS Parameters**: Support for custom command-line toggles (e.g., `-missing`) and dynamic parameter exposure via backend APIs.
- **Extended Force Fields**: Auto-installation of modern topologies including `charmm36`, `amber03ws`, and `amber14sb_OL15`.
- **Native User Management**: Built-in Admin dashboard with CRUD operations, role assignments, and email notifications for approvals and workflow events.
- **Enhanced Export Capabilities**: Dynamic SVG exports that correctly bind user-defined plot titles, styled backgrounds, and properly-centered axis labels.
- **New Branding**: Isometric simulation box SVG logo natively integrated into the UI and favicon.

### Changed
- **Modular Pipeline**: Completely refactored the Python execution backend (`runner.py` to `simulations/gmx/*`) to handle robust, parameter-rich GROMACS commands.
- **Dynamic Workflows**: Simulation options (force fields, water models) are now populated dynamically directly from the underlying engine context.
- **Two-Tier Docker Architecture**: Decoupled environment tools (CUDA, OpenCL, Node) into pre-built base images, slashing local build and deployment times to mere seconds.
- **Thorough Code Cleanup**: Removed redundant variables, fixed implicit typing errors in the frontend, and scrubbed development artifacts for a production-ready codebase.

### Fixed
- Stabilized deployment scripts (`start.sh`) preventing UI browser crashes and addressing Docker compose timeouts on headless servers.
- Corrected numerous backend container crashes caused by path resolution and python binary variations on Ubuntu base images.
- Re-architected CUDA base images using 12.0.1 for significantly broader host GPU driver compatibility.
- Fixed axis label overflows and chart cutoff issues in the Analysis and Workflow UI plots.

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
