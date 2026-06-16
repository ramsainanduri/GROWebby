# ── GROWebby Frontend App Image ────────────────────────────────────────────────
# Thin app layer: pulls the pre-built base image and copies React source code.
# The base image contains Node 22 and all node_modules.
# Only this COPY layer changes on code updates — builds in seconds.
# ──────────────────────────────────────────────────────────────────────────────
FROM ramsainanduri/growebby-base-frontend:latest

WORKDIR /app

# Copy package manifests and install any new dependencies
# This ensures that packages added locally (like monaco-editor) are installed during build
COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 5173
CMD ["sh", "-c", "if [ \"$DJANGO_DEBUG\" = \"0\" ]; then npm run build && npm run preview; else npm run dev; fi"]
