#!/bin/bash
set -e

echo "Deploying kanban board..."

cd "$(dirname "$0")"

docker compose build

# Caddy apart: bij gewijzigde Caddyfile live herladen i.p.v. de container
# opnieuw te maken — zo blijft TLS voor alle domeinen (ook tam.*) staan.
docker compose up -d --no-recreate caddy 2>/dev/null || docker compose up -d caddy
docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile 2>/dev/null || true

docker compose up -d db backend frontend

echo "Deployment complete."
