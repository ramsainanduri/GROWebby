# Access Control and GPU Support

## Authentication

GROWebby now supports local session authentication through Django:

- `POST /api/auth/register/`
- `POST /api/auth/login/`
- `POST /api/auth/logout/`
- `GET /api/auth/session/`

The frontend uses these endpoints with secure session cookies and CSRF tokens. Local users can create accounts and sign in from the application header.

## First Admin Account

GROWebby does not ship with a default admin username or password.

After the Docker services are running, create the first admin account:

```bash
docker compose exec backend python manage.py ensure_admin \
  --username admin \
  --email admin@example.com \
  --password "change-this-password"
```

The password must be at least 8 characters. If the username already exists, the command exits with an error and does not modify that user.

You can still use Django’s built-in interactive command if preferred:

```bash
docker compose exec backend python manage.py createsuperuser
```

`createsuperuser` is interactive and also fails when the username conflicts with an existing account.

## Promoting Users

Admins can make another user an admin in Django admin:

1. Sign in at `http://localhost:8000/admin/`.
2. Open **Users**.
3. Select the user.
4. Enable **Staff status** so the user can access Django admin.
5. Enable **Superuser status** only when the user should have full permissions.
6. Save.

For command-line promotion:

```bash
docker compose exec backend python manage.py promote_admin researcher
```

To grant full superuser permissions:

```bash
docker compose exec backend python manage.py promote_admin researcher --superuser
```

## Ownership and Groups

Uploaded coordinate files and simulation runs have:

- `owner`
- `group`

Regular users see their own uploads and runs, plus records assigned to their groups. Staff users can see all uploads and runs. This gives the admin panel a clean path to group-based lab/team access.

## GPU Support

The current Docker GPU engine is CUDA-based and targets Linux hosts with NVIDIA GPUs and NVIDIA Container Toolkit.

Apple M-series Macs do not have NVIDIA GPUs or CUDA. The current GROMACS installation guide lists Apple M-series GPU acceleration under OpenCL. That means Mac GPU support needs a separate OpenCL-oriented GROMACS build path, not the CUDA container.

Recommended execution paths:

- macOS development: backend/frontend locally or Docker, CPU/fallback execution.
- Linux + NVIDIA: CUDA `gromacs-cuda-engine` via `docker compose --profile cuda up --build`.
- Linux + AMD/Intel: future SYCL engine image.
- Apple M-series GPU: native OpenCL GROMACS build path, outside the CUDA container.

## Engine Selection

Run:

```bash
./install.sh
```

The installer writes `.env` and `.app_state/engine-selection.env`.

Selection rules:

- macOS Apple Silicon: `GROWEBBY_ENGINE=mac-opencl-native`, `GROMACS_EXECUTION_MODE=native-opencl`.
- Linux with `nvidia-smi`: `GROWEBBY_ENGINE=linux-nvidia-cuda`, `COMPOSE_PROFILES=cuda`.
- Linux without NVIDIA detection: `GROWEBBY_ENGINE=linux-cpu`, `COMPOSE_PROFILES=cpu`.
- Windows default: `GROWEBBY_ENGINE=windows-cpu`, `COMPOSE_PROFILES=cpu`.

For Apple Silicon, the installer checks for a native `gmx` binary. If it is missing, the web app still runs, but Mac GPU execution is not available until a native OpenCL-capable GROMACS installation is present.
