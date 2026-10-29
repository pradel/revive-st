---
"@revive-st/api": minor
---

The server is published as a container image, `ghcr.io/pradel/revive-st-api`, for `linux/amd64` and `linux/arm64`, so a household can run its own. Each API release is tagged with its version and `latest`. The image runs as a non-root user, listens on port `3000` and keeps its database in the `/data` volume; `apps/api/compose.yaml` runs it with Docker Compose.
