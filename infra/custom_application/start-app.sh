#!/usr/bin/env sh
# DataRobot start hook — container entrypoint
# Starts the Node.js server that listens on PORT (8080 set in Dockerfile).
set -eu
# Enable pipefail where supported (e.g., Bash). POSIX /bin/sh in Debian lacks it.
if (set -o | grep -q pipefail) 2>/dev/null; then
  set -o pipefail
fi

# set OPENAI_API_KEY as DATAROBOT_API_TOKEN
export OPENAI_API_KEY="$DATAROBOT_API_TOKEN"

# set OPENAI_API_BASE_URL as DATAROBOT_ENDPOINT append /genai/llmgw
export OPENAI_API_BASE_URL="${DATAROBOT_ENDPOINT}/genai/llmgw"

# set OPENAI_MODEL
export OPENAI_MODEL="vertex_ai/gemini-2.5-flash"

echo "Starting application on port ${PORT:-8080}…"
exec npm start
