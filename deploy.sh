#!/bin/bash
set -e

echo "Deploying kanban board..."

cd "$(dirname "$0")"

docker compose build
docker compose up -d

echo "Deployment complete."
