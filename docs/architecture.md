# Architecture

GROWebby separates the browser UI, Django API, and selectable GROMACS execution engines into Docker Compose services.

The backend owns uploads, job state, progress, logs, and the GROMACS integration boundary. The host/backend dependency set intentionally avoids `gmxapi` because the package needs the underlying GROMACS software at install time. `install.sh` detects the host and writes `.env` with an engine selection: Linux/NVIDIA uses the CUDA engine profile, generic hosts use the CPU engine profile, and Apple Silicon selects native OpenCL mode because CUDA is not available on M-series Macs. If the selected engine is unavailable during local development, the backend runs a deterministic fallback pipeline so the interface remains usable while execution is being configured.

The frontend guides non-technical users through topology generation, box definition, solvation, ions, minimization, equilibration, and production MD. It uses simple controls and smart defaults, then starts a simulation through the backend API.
