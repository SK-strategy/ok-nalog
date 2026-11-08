#!/usr/bin/env bash
# Обновление приложений на сервере до свежих образов из GitHub.
# Запускать после того, как в GitHub (Actions → Build images) прошла сборка.
# Если менялся код Convex — отдельно запустите Actions → Convex deploy.
set -euo pipefail
cd /opt/ok-nalog
COMPOSE="docker compose -f docker-compose.prod.yml"
$COMPOSE pull web admin tma bot
$COMPOSE up -d web admin tma bot
docker image prune -f >/dev/null
$COMPOSE ps
