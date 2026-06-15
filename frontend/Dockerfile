# ── GROWebby Frontend App Image ────────────────────────────────────────────────
# Thin app layer: pulls the pre-built base image and copies React source code.
# The base image contains Node 22 and all node_modules.
# Only this COPY layer changes on code updates — builds in seconds.
# ──────────────────────────────────────────────────────────────────────────────
FROM ramsainanduri/growebby-base-frontend:latest

WORKDIR /app
COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev"]
