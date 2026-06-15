# ── GROWebby Frontend Base Image ───────────────────────────────────────────────
# Contains: Node 22 + npm dependencies (node_modules baked in).
# Does NOT contain application source code.
#
# Rebuild and push when package.json / package-lock.json changes.
# Build:  docker build -t ramsainanduri/growebby-base-frontend:latest docker/base-frontend/
# Push:   docker push ramsainanduri/growebby-base-frontend:latest
# ──────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

# Copy only manifests so node_modules layer is cached until deps change
COPY package.json package-lock.json* ./
RUN npm install
