# Развёртывание ОК-налог на своём сервере

Схема: GitHub Actions собирает Docker-образы → сервер забирает их из GitHub Container Registry →
Caddy выдаёт HTTPS → приложения (web, admin, tma, bot) + Convex + Postgres работают в Docker.
Функции Convex выкатываются отдельным workflow. Ничего не нужно собирать на своём компьютере.

| Адрес                         | Что это                                          |
| ----------------------------- | ------------------------------------------------ |
| `oknalog.net` (+ `www`)       | Публичный сайт                                   |
| `admin.oknalog.net`           | Админка                                          |
| `tma.oknalog.net`             | Telegram Mini App                                |
| `api.oknalog.net`             | Convex (API, синхронизация, вход через Telegram) |
| `convex.admin.oknalog.net`    | Панель Convex (под паролем)                      |

Минимальный сервер: 2 vCPU, 4 ГБ RAM, 40 ГБ диска, Ubuntu 24.04, публичный IPv4.
Текущий сервер: VDSina, Москва, 4 vCPU / 8 ГБ / 150 ГБ, IP `138.16.183.89`.

---

## Первый запуск

### 1. DNS

В панели, где управляется домен, создайте шесть A-записей на IP сервера:
`@`, `www`, `admin`, `tma`, `api`, `convex.admin` → `138.16.183.89`.
Проверка: `nslookup api.oknalog.net` должен вернуть IP сервера.

### 2. Образы в GitHub

В репозитории: Actions → **Build images** → Run workflow (или просто слейте ветку в `main`).
Дождитесь зелёного статуса. Образы появятся в Packages профиля `SK-strategy`
(`ok-nalog-web`, `-admin`, `-tma`, `-bot`, `-deploy`).

### 3. Токен для сервера

GitHub → Settings → Developer settings → Personal access tokens → **Tokens (classic)** →
Generate new token, право только `read:packages`. Сохраните токен: он нужен серверу, чтобы
скачивать образы (репозиторий приватный).

### 4. Установка на сервере

Откройте веб-консоль сервера в панели VDSina (или `ssh root@138.16.183.89`) и выполните:

```bash
apt-get update && apt-get install -y docker.io
docker login ghcr.io -u SK-strategy        # пароль = токен из шага 3
mkdir -p /opt/ok-nalog
docker run --rm -v /opt/ok-nalog:/out ghcr.io/sk-strategy/ok-nalog-deploy:latest
cd /opt/ok-nalog && bash bootstrap.sh
```

Скрипт задаст несколько вопросов (домен, email, токен бота из @BotFather, ключ Resend — по желанию),
сам поставит Docker/файрвол/защиту от подбора паролей, сгенерирует все секреты, запустит сервисы
и включит ежедневные копии базы. В конце он напечатает три значения для следующего шага.

### 5. Секреты GitHub

Репозиторий → Settings → Secrets and variables → Actions → New repository secret:
`CONVEX_SELF_HOSTED_URL`, `CONVEX_SELF_HOSTED_ADMIN_KEY`, `CONVEX_ENV` (значения из вывода скрипта).
Необязательно: `NEXT_PUBLIC_SENTRY_DSN`, если нужен Sentry в браузере.

### 6. Функции Convex

Actions → **Convex deploy** → Run workflow, отметьте «seed». Это выложит функции, применит
настройки и загрузит справочник. При первом запуске создаётся и ключ подписи сессий (JWKS).

### 7. BotFather

В `@BotFather`: `/setdomain` для бота → `oknalog.net`; Mini App → URL `https://tma.oknalog.net`.
Если включён вход через OIDC, Redirect URL = `https://api.oknalog.net/api/auth/callback/telegram-oidc`
(и добавьте `TELEGRAM_OIDC_CLIENT_ID` / `TELEGRAM_OIDC_CLIENT_SECRET` в секрет `CONVEX_ENV`,
затем снова запустите Convex deploy).

### 8. Проверка

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://oknalog.net
curl -sS -o /dev/null -w '%{http_code}\n' https://admin.oknalog.net
curl -sS -o /dev/null -w '%{http_code}\n' https://tma.oknalog.net
curl -sS https://api.oknalog.net/version
docker compose -f /opt/ok-nalog/docker-compose.prod.yml logs bot | grep 'authenticated as'
```

Затем войдите на сайт через Telegram и назначьте себе роль `admin`: панель Convex
(`https://convex.admin.oknalog.net`) → таблица `users` → поле `role`.

> Не запускайте больше одного контейнера `bot` и не запускайте бота локально, пока работает
> сервер: у токена Telegram может быть только один получатель обновлений.

---

## Обновление

1. Слейте изменения в `main` (или запустите Build images вручную), дождитесь сборки.
2. На сервере: `bash /opt/ok-nalog/update.sh`.
3. Если менялся код в `backend/convex` — запустите Actions → **Convex deploy**.

Чтобы сменить настройки Convex (ключи, ссылки), отредактируйте секрет `CONVEX_ENV` и
перезапустите Convex deploy.

## Копии

Скрипт `/usr/local/bin/ok-nalog-backup` каждую ночь в 03:15 сохраняет базу и файлы Convex в
`/var/backups/ok-nalog` (хранится 14 дней, лог: `/var/log/ok-nalog-backup.log`).
Копии лежат на том же сервере: периодически скачивайте их (`scp`) или включите снапшоты у хостера.
Восстановление базы: `gunzip -c db-….sql.gz | docker compose -f docker-compose.prod.yml exec -T postgres psql -U tax_assistant -d tax_assistant`.

## Перед приёмом реальных клиентов

См. `PROJECT_PLAN.md`, эпик E0: закрыть доступ к файлам заказов, отключить mock-оплату
(`PAYMENTS_PROVIDER`), согласовать срок оплаты. До этого сервис нельзя открывать для людей.

---

## Если что-то не работает

**Caddy не выпускает сертификаты.** Проверьте, что все шесть A-записей указывают на сервер и порты
80/443 открыты (`ufw status`). Лог: `docker compose -f docker-compose.prod.yml logs caddy`.

**`unable_to_get_user_info` при входе.** Неверный `TELEGRAM_OIDC_CLIENT_SECRET` или Redirect URL в
BotFather не совпадает посимвольно с `https://api.oknalog.net/api/auth/callback/telegram-oidc`.

**`account_not_linked` / «No session found».** В коде `accountLinking.requireLocalEmailVerified`
должен быть `false` (почты Telegram синтетические); проверьте, что выложена свежая версия функций.

**Синхронизация зависает на «connecting».** Путь `/api/sync` должен идти в Convex Cloud (`:3210`);
в Caddyfile на сайт (`:3211`) уходят только `/api/auth*`, `/.well-known/*`, `/bot/*`.

**Панель Convex просит пароль снова и снова.** Хэш в `.env` (`DASHBOARD_BCRYPT`) должен быть в
одинарных кавычках, как его записал `bootstrap.sh`. Пароль лежит в `dashboard-password.txt`
(если вы его уже удалили — сгенерируйте новый хэш:
`docker run --rm caddy:2-alpine caddy hash-password --plaintext '<пароль>'`).

**Образы не скачиваются.** Повторите `docker login ghcr.io`: токен должен иметь право `read:packages`.
