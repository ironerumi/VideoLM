#!/usr/bin/env sh
# DataRobot build hook — executed after Dockerfile completes
# Installs Node dependencies and builds the production bundle.
# Use strict mode.
set -eu
# Enable pipefail where supported (e.g., Bash). POSIX /bin/sh in Debian lacks it.
if (set -o | grep -q pipefail) 2>/dev/null; then
  set -o pipefail
fi

echo "Installing production dependencies (npm ci --omit=dev)…"
npm ci --omit=dev

echo "Running application build (npm run build)…"
npm run build
