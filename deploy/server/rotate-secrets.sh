#!/usr/bin/env bash
# Замена секретов ОК-налог на новые: токен бота (вводите новый из @BotFather),
# BETTER_AUTH_SECRET, BOT_SERVICE_SECRET, INSTANCE_SECRET и ключ администратора Convex.
# Запускать от root, ДО первого запуска «Convex deploy» (пока в базе нет данных):
#   cd /opt/ok-nalog && bash rotate-secrets.sh
# Пароль панели Convex и пароль Postgres не меняются.
set -euo pipefail
cd /opt/ok-nalog
COMPOSE="docker compose -f docker-compose.prod.yml"

[ -f .env ] || { echo "Нет .env — сначала bootstrap.sh"; exit 1; }
DOMAIN="$(grep -E '^DOMAIN=' .env | cut -d= -f2-)"

setenv() { # setenv KEY VALUE — заменить строку KEY=... в .env
  awk -v k="$1" -v v="$2" 'BEGIN{FS=OFS="="} $1==k{print k"="v; next} {print}' .env > .env.tmp
  mv .env.tmp .env
}

read -r -s -p "НОВЫЙ токен бота из @BotFather (ввод скрыт): " TOKEN
echo
[ -n "$TOKEN" ] || { echo "Токен пустой"; exit 1; }

echo "Проверяю токен в Telegram..."
if curl -fsS --max-time 15 "https://api.telegram.org/bot${TOKEN}/getMe" | grep -q '"ok":true'; then
  echo "  токен рабочий"
else
  echo "  !! Telegram не подтвердил токен (опечатка или нет доступа к api.telegram.org). Прервано, ничего не изменено."
  exit 1
fi

BOT_SECRET="$(openssl rand -hex 32)"
setenv TELEGRAM_BOT_TOKEN "$TOKEN"
setenv BOT_SERVICE_SECRET "$BOT_SECRET"
setenv INSTANCE_SECRET "$(openssl rand -hex 32)"

umask 077
BOT_USERNAME="$(grep -E '^NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=' convex.env 2>/dev/null | cut -d= -f2- || true)"
BOT_USERNAME="${BOT_USERNAME:-Oknalog_net_bot}"
RESEND_LINES="$(grep -E '^RESEND_' convex.env 2>/dev/null || true)"
{
  echo "BETTER_AUTH_SECRET=$(openssl rand -hex 32)"
  echo "TELEGRAM_BOT_TOKEN=$TOKEN"
  echo "NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=$BOT_USERNAME"
  echo "WEB_ORIGIN=https://$DOMAIN"
  echo "ADMIN_ORIGIN=https://admin.$DOMAIN"
  echo "TMA_ORIGIN=https://tma.$DOMAIN"
  echo "BOT_SERVICE_SECRET=$BOT_SECRET"
  [ -n "$RESEND_LINES" ] && echo "$RESEND_LINES"
} > convex.env.new
mv convex.env.new convex.env

echo "Перезапускаю Convex и бота с новыми секретами..."
$COMPOSE up -d --force-recreate convex-backend
KEY=""
for _ in $(seq 1 40); do
  KEY="$($COMPOSE exec -T convex-backend ./generate_admin_key.sh 2>/dev/null | grep '|' | tail -n1 || true)"
  [ -n "$KEY" ] && break
  sleep 3
done
[ -n "$KEY" ] || { echo "Не удалось получить ключ. Смотрите: $COMPOSE logs convex-backend"; exit 1; }
setenv CONVEX_SELF_HOSTED_ADMIN_KEY "$KEY"
$COMPOSE up -d --force-recreate convex-dashboard bot

echo
echo "==================== ГОТОВО ===================="
echo "Добавьте в GitHub → Settings → Secrets and variables → Actions три секрета:"
echo
echo "  CONVEX_SELF_HOSTED_URL        = https://api.$DOMAIN"
echo "  CONVEX_SELF_HOSTED_ADMIN_KEY  = $KEY"
echo "  CONVEX_ENV                    = (всё содержимое convex.env, выведенного ниже)"
echo
echo "---------- convex.env ----------"
cat convex.env
echo "--------------------------------"
echo
echo "НЕ делайте скриншот и не отправляйте это в чат. Сохраните в «Пароли»,"
echo "затем: rm convex.env dashboard-password.txt && clear"
