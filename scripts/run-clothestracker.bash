#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="clothestracker"
HOST_PORT="4242"
CONTAINER_PORT="4000"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required but was not found in PATH." >&2
  exit 1
fi

echo "Building Docker image '${IMAGE_NAME}'..."
docker build -t "${IMAGE_NAME}" "$(dirname "$0")/.."

EXISTING_CONTAINER=$(docker ps --filter "ancestor=${IMAGE_NAME}" --filter "status=running" --format "{{.ID}}")

if [ -n "${EXISTING_CONTAINER}" ]; then
  echo "Stopping existing container (${EXISTING_CONTAINER}) for image ${IMAGE_NAME}..."
  docker stop "${EXISTING_CONTAINER}"
fi

PORT_CONTAINER=$(docker ps --filter "publish=${HOST_PORT}" --format "{{.ID}}")

if [ -n "${PORT_CONTAINER}" ]; then
  echo "Releasing port ${HOST_PORT} from container ${PORT_CONTAINER}..."
  docker stop "${PORT_CONTAINER}"
fi

echo "Running container on http://localhost:${HOST_PORT} (Ctrl+C to stop)..."
docker run --rm -p "${HOST_PORT}:${CONTAINER_PORT}" "${IMAGE_NAME}"
