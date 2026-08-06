#!/usr/bin/env bash
# Run this ON the VPS, from the repo root (~/claude-intercom).
#
# Without a registry, Swarm has no way to tell that "claude-intercom-api:latest"
# changed content after a rebuild — the tag string is identical, so a plain
# `docker stack deploy` silently keeps the OLD container running. This is what
# made deploys look like they "just don't take" some of the time. Always force
# both services after deploying so a stale image can never linger unnoticed.
set -euo pipefail
cd "$(dirname "$0")"

docker build -t claude-intercom-api:latest .
set -a
. ./.env
set +a
docker build -t claude-intercom-web:latest \
  --build-arg NEXT_PUBLIC_INTERCOM_API_URL="${PUBLIC_INTERCOM_API_URL:-http://localhost:8787}" \
  ./web

docker stack deploy -c docker-compose.yml -c docker-compose.vps.yml -c docker-compose.vps.local.yml claude-intercom

docker service update --force claude-intercom_api
docker service update --force claude-intercom_web

echo "--- verifying ---"
docker inspect claude-intercom-api:latest --format '{{.Id}}'
docker inspect "$(docker ps -qf name=claude-intercom_api)" --format 'running: {{.Image}}'
curl -sf https://intercom.utilitaires.ci/health && echo
