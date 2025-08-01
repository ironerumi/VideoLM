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

# set OPENAI_BASE_URL as DATAROBOT_ENDPOINT append /genai/llmgw
export OPENAI_BASE_URL="${DATAROBOT_ENDPOINT}/genai/llmgw"

# set OPENAI_MODEL
export OPENAI_MODEL="vertex_ai/gemini-2.5-flash"

echo "🔧 Environment Variables Debug:"
echo "DATAROBOT_API_TOKEN: ${DATAROBOT_API_TOKEN:0:10}..." 
echo "DATAROBOT_ENDPOINT: $DATAROBOT_ENDPOINT"
echo "OPENAI_API_KEY: ${OPENAI_API_KEY:0:10}..."
echo "OPENAI_BASE_URL: $OPENAI_BASE_URL"
echo "OPENAI_MODEL: $OPENAI_MODEL"
echo ""
echo "Starting application on port ${PORT:-8080}…"
exec npm start
