#!/usr/bin/env sh
# DataRobot start hook — container entrypoint
# Starts the Node.js server that listens on PORT (8080 set in Dockerfile).
set -eu
# Enable pipefail where supported (e.g., Bash). POSIX /bin/sh in Debian lacks it.
if (set -o | grep -q pipefail) 2>/dev/null; then
  set -o pipefail
fi

echo "Starting application on port ${PORT:-8080}…"
exec npm start
