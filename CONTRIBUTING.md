# Contributing to GROWebby

Thank you for your interest in contributing to GROWebby. This project is intended for reproducible molecular dynamics workflow preparation, execution, and inspection. Contributions should prioritize correctness, traceability, and clear documentation.

## Maintainer

- Ram Sai Nanduri (GitHub: [@ramsainanduri](https://github.com/ramsainanduri))

## Development Principles

- Keep scientific workflow behavior explicit and auditable.
- Prefer conservative defaults for simulation setup and execution.
- Preserve user data and run artifacts unless a user explicitly requests deletion.
- Keep UI language professional and direct
- Document any behavior that affects files, storage, execution mode, or reproducibility.

## Local Setup

```bash
cp .env.example .env
./install.sh
./start.sh
```

The default local storage path for uploads, run workspaces, logs, and artifacts is:

```text
<project-root>/.app_state/media/
```

Run results are stored under:

```text
<project-root>/.app_state/media/workspaces/<run-workspace-slug>/
```

In Docker, the same directory is mounted as:

```text
/app/media
/app/media/workspaces
```

Standalone GROMACS engine containers mount the same host directory at:

```text
/work
/work/workspaces
```

## Checks Before Submitting Changes

Run these commands before opening a pull request:

```bash
./.venv/bin/python backend/manage.py makemigrations --check --dry-run
./.venv/bin/python backend/manage.py test accounts simulations
cd frontend
npm run build
```

## Pull Request Guidelines

- Describe the workflow or user-facing behavior affected by the change.
- Include migration notes if database fields are added or changed.
- Include storage or artifact-path notes if file layout changes.
- Add or update tests for authentication, ownership, job state, artifacts, and run execution behavior.
- Update documentation when changing installation, configuration, workflow options, or analysis outputs.

## Documentation

Documentation lives in `docs/`. Changes to behavior should usually update at least one of:

- `docs/user-guide.md`
- `docs/simulation-workflow.md`
- `docs/architecture.md`
- `docs/operations.md`
- `docs/administration.md`

## License

By contributing, you agree that your contributions are provided under the MIT License.
