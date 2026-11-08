#!/usr/bin/env bash
# Ежедневная копия базы (Postgres) и файлов Convex. Ставится в cron скриптом bootstrap.sh.
# Копии лежат в /var/backups/ok-nalog и хранятся 14 дней.
# ВАЖНО: копии на том же сервере не спасут при потере самого сервера — периодически
# скачивайте их к себе (scp) или подключите платные снапшоты у хостера.
set -euo pipefail

cd /opt/ok-nalog
OUT=/var/backups/ok-nalog
TS="$(date +%Y%m%d-%H%M)"
COMPOSE="docker compose -f docker-compose.prod.yml"
mkdir -p "$OUT"

PGUSER="$(grep -E '^POSTGRES_USER=' .env | cut -d= -f2-)"
PGDB="$(grep -E '^POSTGRES_DB=' .env | cut -d= -f2-)"

$COMPOSE exec -T postgres pg_dump -U "$PGUSER" -d "$PGDB" | gzip > "$OUT/db-$TS.sql.gz"
docker run --rm -v ok-nalog_convex_data:/data:ro -v "$OUT":/out alpine \
  tar czf "/out/files-$TS.tar.gz" -C /data .

find "$OUT" -type f -mtime +14 -delete
echo "$(date -Is) backup ok: $OUT/db-$TS.sql.gz, files-$TS.tar.gz"
