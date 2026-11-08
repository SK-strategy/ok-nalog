#!/usr/bin/env bash
# Первичная установка ОК-налог на чистый сервер Ubuntu 24.04. Запускать от root:
#   cd /opt/ok-nalog && bash bootstrap.sh
# Скрипт безопасно запускать повторно: уже созданные секреты (.env) он не перегенерирует.
set -euo pipefail

cd /opt/ok-nalog
COMPOSE="docker compose -f docker-compose.prod.yml"

ask() { # ask VAR "Вопрос" [по умолчанию] [secret]
  local var="$1" prompt="$2" def="${3:-}" secret="${4:-}" val
  if [ -n "${!var:-}" ]; then return; fi
  if [ -n "$secret" ]; then
    read -r -s -p "$prompt: " val
    echo
  else
    read -r -p "$prompt${def:+ [$def]}: " val
  fi
  printf -v "$var" '%s' "${val:-$def}"
}

setenv() { # setenv KEY VALUE — заменить строку KEY=... в .env
  awk -v k="$1" -v v="$2" 'BEGIN{FS=OFS="="} $1==k{print k"="v; next} {print}' .env > .env.tmp
  mv .env.tmp .env
}

echo "== 1/7 Система: Docker, файрвол, защита от подбора паролей"
export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a
apt-get update -y
apt-get install -y docker.io docker-compose-v2 ufw openssl curl fail2ban
systemctl enable --now docker fail2ban
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q /swapfile /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

echo "== 2/7 Настройки"
if [ ! -f .env ]; then
  ask DOMAIN "Домен проекта" "oknalog.net"
  ask OWNER "Владелец образов на GitHub (в нижнем регистре)" "sk-strategy"
  ask LE_EMAIL "Email для сертификатов Let's Encrypt"
  ask TELEGRAM_BOT_TOKEN "Токен бота из @BotFather (ввод скрыт)" "" secret
  ask BOT_USERNAME "Имя бота без @" "Oknalog_net_bot"
  ask RESEND_API_KEY "Ключ Resend для писем (Enter — пропустить)" ""

  cp .env.prod.example .env
  chmod 600 .env
  DASH_PASS="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)"
  DASH_HASH="$(docker run --rm caddy:2-alpine caddy hash-password --plaintext "$DASH_PASS")"
  BOT_SECRET="$(openssl rand -hex 32)"

  sed -i "s|oknalog\.net|$DOMAIN|g; s|ghcr.io/sk-strategy/|ghcr.io/$OWNER/|g" .env
  setenv DOMAIN "$DOMAIN"
  setenv POSTGRES_PASSWORD "$(openssl rand -hex 24)"
  setenv INSTANCE_SECRET "$(openssl rand -hex 32)"
  setenv LE_EMAIL "$LE_EMAIL"
  setenv TELEGRAM_BOT_TOKEN "$TELEGRAM_BOT_TOKEN"
  setenv BOT_SERVICE_SECRET "$BOT_SECRET"
  setenv DASHBOARD_BCRYPT "'$DASH_HASH'"

  umask 077
  {
    echo "BETTER_AUTH_SECRET=$(openssl rand -hex 32)"
    echo "TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN"
    echo "NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=$BOT_USERNAME"
    echo "WEB_ORIGIN=https://$DOMAIN"
    echo "ADMIN_ORIGIN=https://admin.$DOMAIN"
    echo "TMA_ORIGIN=https://tma.$DOMAIN"
    echo "BOT_SERVICE_SECRET=$BOT_SECRET"
    if [ -n "$RESEND_API_KEY" ]; then
      echo "RESEND_API_KEY=$RESEND_API_KEY"
      echo "RESEND_FROM=Налоговый помощник <auth@$DOMAIN>"
    fi
  } > convex.env
  echo "$DASH_PASS" > dashboard-password.txt
else
  echo ".env уже есть — секреты не трогаю"
fi
DOMAIN="$(grep -E '^DOMAIN=' .env | cut -d= -f2-)"

echo "== 3/7 Проверка DNS"
SERVER_IP="$(curl -fsS4 https://ifconfig.me || true)"
for h in "$DOMAIN" "admin.$DOMAIN" "tma.$DOMAIN" "api.$DOMAIN" "convex.admin.$DOMAIN"; do
  got="$(getent ahostsv4 "$h" | awk 'NR==1{print $1}')"
  if [ "$got" = "$SERVER_IP" ]; then echo "  ok   $h -> $got"; else echo "  !!   $h -> ${got:-нет записи} (ожидается $SERVER_IP)"; fi
done
echo "  Если есть «!!» — добавьте A-записи в DNS домена, сертификаты выпустятся после обновления DNS."

echo "== 4/7 Запуск базы, Convex и Caddy"
$COMPOSE pull postgres convex-backend caddy convex-dashboard
$COMPOSE up -d postgres convex-backend caddy

echo "== 5/7 Ключ администратора Convex"
KEY=""
for _ in $(seq 1 40); do
  KEY="$($COMPOSE exec -T convex-backend ./generate_admin_key.sh 2>/dev/null | grep '|' | tail -n1 || true)"
  [ -n "$KEY" ] && break
  sleep 3
done
[ -n "$KEY" ] || { echo "Не удалось получить ключ. Смотрите: $COMPOSE logs convex-backend"; exit 1; }
setenv CONVEX_SELF_HOSTED_ADMIN_KEY "$KEY"
$COMPOSE up -d convex-dashboard

echo "== 6/7 Приложения"
$COMPOSE pull web admin tma bot
$COMPOSE up -d web admin tma bot

echo "== 7/7 Ежедневные копии"
install -m 755 backup.sh /usr/local/bin/ok-nalog-backup
echo '15 3 * * * root /usr/local/bin/ok-nalog-backup >> /var/log/ok-nalog-backup.log 2>&1' > /etc/cron.d/ok-nalog-backup

echo
echo "==================== ГОТОВО ===================="
echo "Сервер: $SERVER_IP, домен: $DOMAIN"
echo
echo "Добавьте в GitHub → репозиторий → Settings → Secrets and variables → Actions три секрета:"
echo
echo "  CONVEX_SELF_HOSTED_URL        = https://api.$DOMAIN"
echo "  CONVEX_SELF_HOSTED_ADMIN_KEY  = $KEY"
echo "  CONVEX_ENV                    = (всё содержимое файла, выведенного ниже)"
echo
echo "---------- convex.env ----------"
cat convex.env
echo "--------------------------------"
echo
echo "Пароль входа в панель Convex (https://convex.admin.$DOMAIN, пользователь admin):"
cat dashboard-password.txt
echo
echo "НИКОМУ не отправляйте эти значения, в том числе в чат с ассистентом."
echo "Сохраните их в менеджере паролей, затем удалите файлы: rm convex.env dashboard-password.txt"
echo "Дальше: GitHub → Actions → «Convex deploy» → Run workflow (отметьте seed)."
