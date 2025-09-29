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

echo "Running container on http://localhost:${HOST_PORT} (Ctrl+C to stop)..."
docker run --rm -p "${HOST_PORT}:${CONTAINER_PORT}" "${IMAGE_NAME}"
