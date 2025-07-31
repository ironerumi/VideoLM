# Custom Node.js Application Drop-In Environment

This Docker image is a **lightweight base** for developing and deploying Node.js applications (such as VideoLM’s backend) inside DataRobot or any container platform.

| Item | Value |
|------|-------|
| **Base image** | `node:lts-bookworm-slim` |
| **Pre-installed APT packages** | `ffmpeg`, `python3`, `build-essential` |
| **Working directory** | `/opt/code` |
| **Environment variables** | `NODE_ENV=production`, `PORT=8080` |
| **Exposed port** | `8080` |

---

## Why these system packages?

| Package | Purpose |
|---------|---------|
| `ffmpeg` | Frame extraction and other video processing tasks. |
| `python3` | Enables Node.js native modules that rely on Python during build or runtime. |
| `build-essential` | Toolchain (gcc, make, etc.) required to compile native Node addons. |

---

## Quick start

1. **Add your application source** (including `package.json`) to `/opt/code` – either by placing files next to this Dockerfile or copying them in a separate Dockerfile stage.
2. Ensure your server listens on the `PORT` environment variable (default **8080**).
3. Build the image:

   ```bash
   docker build -t my-node-app -f infra/custom_environment/Dockerfile .
   ```

4. Run locally:

   ```bash
   docker run -p 8080:8080 my-node-app
   ```

---

## Extending the image

If additional system libraries are required, create a new Dockerfile that starts **FROM** this image and installs what you need:

```Dockerfile
FROM my-node-app  # or use the path to this Dockerfile directly
RUN apt-get update && \
    apt-get install -y --no-install-recommends <more-packages> && \
    apt-get clean && rm -rf /var/lib/apt/lists/*
```

---

## Notes

- DataRobot maps incoming traffic to port **8080**; therefore the container must expose and listen on this port.
- The `apt-get clean` and removal of `/var/lib/apt/lists/*` keep the final image small.
- Setting `NODE_ENV=production` activates production optimizations in many Node.js frameworks.

This README now accurately reflects the configuration defined in `infra/custom_environment/Dockerfile`.
