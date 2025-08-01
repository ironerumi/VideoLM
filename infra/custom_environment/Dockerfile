# Base runtime image for DataRobot custom model
FROM node:lts-bookworm-slim

# -----------------------------------------------------------------------------
# 1. Install system-level dependencies required by the application
# -----------------------------------------------------------------------------
# – ffmpeg          : video frame extraction used by the backend service
# – python3 + build-essential : build helpers for native Node modules
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ffmpeg \
        python3 \
        build-essential \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# -----------------------------------------------------------------------------
# 2. Prepare working directory
# -----------------------------------------------------------------------------
WORKDIR /opt/code

# -----------------------------------------------------------------------------
# 3. Runtime environment variables
# -----------------------------------------------------------------------------
ENV NODE_ENV=production
# DataRobot maps traffic to port 8080; the server reads this env var
ENV PORT=8080

# -----------------------------------------------------------------------------
# 4. Expose port expected by DataRobot
# -----------------------------------------------------------------------------
EXPOSE 8080
