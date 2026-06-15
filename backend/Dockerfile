# ── GROWebby Backend App Image ─────────────────────────────────────────────────
# Thin app layer: pulls the pre-built base image and copies Django source code.
# Select the correct base with the BASE_IMAGE build argument:
#
#   cpu   (default): ramsainanduri/growebby-base-backend-cpu:latest
#   cuda:            ramsainanduri/growebby-base-backend-cuda:latest
#   metal:           ramsainanduri/growebby-base-backend-metal:latest
#
# The base image contains GROMACS, system deps, and all pip packages.
# Only this COPY layer changes on code updates — builds in seconds.
# ──────────────────────────────────────────────────────────────────────────────
ARG BASE_IMAGE=ramsainanduri/growebby-base-backend-cpu:latest
FROM ${BASE_IMAGE}

WORKDIR /app
COPY . .

EXPOSE 8000
CMD ["bash", "-lc", "python manage.py migrate && python manage.py ensure_admin && python manage.py runserver 0.0.0.0:8000"]
