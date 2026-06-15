# Changelog

All notable changes to GROWebby are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-06-15

Initial public release.

### Added

- Browser-based GROMACS workflow management for topology generation, box definition, solvation, ion placement, energy minimization, NVT equilibration, NPT equilibration, and production MD.
- Real GROMACS 2026.2 execution through the backend Docker engine, with optional native OpenCL execution for supported Apple Silicon installations and CUDA engine support for Linux NVIDIA hosts.
- Per-run workspaces with generated configuration files, command logs, structures, trajectories, energy files, metrics, and artifact metadata.
- Stepwise execution, full-pipeline execution, prerequisite checks, run grouping, run renaming, run deletion, and run cancellation through stored GROMACS process identifiers.
- Live run status, clean event logs, command-output log artifacts, and interactive plots for GROMACS energy terms where available.
- MolStar-based molecular structure viewer.
- Local session authentication with registration, admin approval, user administration, groups, and per-user run visibility.
- Django REST API for uploads, simulations, logs, artifacts, authentication, administration, health checks, and validation data sets.
- React 19 frontend with TypeScript, URL-based routing, responsive navigation, light and dark themes, and version display.
- Docker Compose configuration, installation scripts, startup scripts, environment template, SQLite storage, and media workspace layout.
- Professional documentation covering user workflows, simulation steps, administration, architecture, operations, storage, logging, plotting, GPU modes, and troubleshooting.
