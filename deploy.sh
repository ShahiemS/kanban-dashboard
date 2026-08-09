#!/bin/bash
set -e

echo "Deploying kanban board..."

cd "$(dirname "$0")"

docker compose down
docker compose up --build -d

echo "Deployment complete."
