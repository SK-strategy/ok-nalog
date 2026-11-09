# Развёртывание ОК-налог на своём сервере

Схема: GitHub Actions собирает Docker-образы → сервер забирает их из GitHub Container Registry →
Caddy выдаёт HTTPS → приложения (web, admin) + Convex + Postgres работают в Docker.
Функции Convex выкатываются отдельным workflow. Ничего не нужно собирать на своём компьютере.

| Адрес                         | Что это                                          |
| ----------------------------- | ------------------------------------------------ |
| `oknalog.net` (+ `www`)       | Публичный сайт                                   |
| `admin.oknalog.net`           | Админка                                          |
| `api.oknalog.net`             | Convex (API, синхронизация, вход по коду)        |
| `convex.admin.oknalog.net`    | Панель Convex (под паролем)                      |

Минимальный сервер: 2 vCPU, 4 ГБ RAM, 40 ГБ диска, Ubuntu 24.04, публичный IPv4.
Вход на сайт — только по email и коду из письма (Telegram, Mini App и бот отключены, их код
закомментирован). Письма отправляет Resend, нужен его API-ключ и подтверждённый домен (шаг 0).

---

## Первый запуск

### 0. Почта для кодов входа (Resend)

1. Зарегистрируйтесь на resend.com → Domains → Add Domain → `oknalog.net`.
2. Resend покажет DNS-записи (DKIM, SPF/MX для `send`). Добавьте их в DNS домена. Старые записи
   Resend прежнего владельца (`resend._domainkey`, `send`, MX на `inbound-smtp…amazonaws.com`) удалите,
   чтобы они не мешали. Дождитесь статуса Verified.
3. API Keys → Create API Key (Sending access). Ключ понадобится установщику.

### 1. DNS

В панели, где управляется домен, создайте пять A-записей на IP сервера:
`@`, `www`, `admin`, `api`, `convex.admin` → IP сервера.
Проверка: `nslookup api.oknalog.net` должен вернуть IP сервера.

### 2. Образы в GitHub

В репозитории: Actions → **Build images** → Run workflow (или просто слейте ветку в `main`).
Дождитесь зелёного статуса. Образы появятся в Packages профиля `SK-strategy`
(`ok-nalog-web`, `-admin`, `-deploy`; образы `-tma` и `-bot` тоже собираются, но не запускаются).

### 3. Токен для сервера

GitHub → Settings → Developer settings → Personal access tokens → **Tokens (classic)** →
Generate new token, право только `read:packages`. Сохраните токен: он нужен серверу, чтобы
скачивать образы (репозиторий приватный).

### 4. Установка на сервере

Откройте веб-консоль сервера в панели VDSina (или `ssh root@IP_СЕРВЕРА`) и выполните:

```bash
apt-get update && apt-get install -y docker.io
docker login ghcr.io -u SK-strategy        # пароль = токен из шага 3
mkdir -p /opt/ok-nalog
docker run --rm -v /opt/ok-nalog:/out ghcr.io/sk-strategy/ok-nalog-deploy:latest
cd /opt/ok-nalog && bash bootstrap.sh
```

Скрипт задаст несколько вопросов (домен, email для сертификатов, ключ Resend и адрес отправителя),
сам поставит Docker/файрвол/защиту от подбора паролей, сгенерирует все секреты, запустит сервисы
и включит ежедневные копии базы. В конце он напечатает три значения для следующего шага.

### 5. Секреты GitHub

Репозиторий → Settings → Secrets and variables → Actions → New repository secret:
`CONVEX_SELF_HOSTED_URL`, `CONVEX_SELF_HOSTED_ADMIN_KEY`, `CONVEX_ENV` (значения из вывода скрипта).
Необязательно: `NEXT_PUBLIC_SENTRY_DSN`, если нужен Sentry в браузере.

### 6. Функции Convex

Actions → **Convex deploy** → Run workflow, отметьте «seed». Это выложит функции, применит
настройки и загрузит справочник. При первом запуске создаётся и ключ подписи сессий (JWKS).

### 7. Проверка

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://oknalog.net
curl -sS -o /dev/null -w '%{http_code}\n' https://admin.oknalog.net
curl -sS https://api.oknalog.net/version
```

Затем войдите на сайт (почта → код из письма) и назначьте себе роль `admin`: панель Convex
(`https://convex.admin.oknalog.net`) → таблица `users` → поле `role`.

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

**Caddy не выпускает сертификаты.** Проверьте, что все пять A-записей указывают на сервер и порты
80/443 открыты (`ufw status`). Лог: `docker compose -f docker-compose.prod.yml logs caddy`.

**Код входа не приходит на почту.** Проверьте в Resend (Logs), что домен Verified и письмо ушло;
посмотрите папку «Спам». Ошибки отправки пишутся в логи Convex (панель Convex → Logs).

**Синхронизация зависает на «connecting».** Путь `/api/sync` должен идти в Convex Cloud (`:3210`);
в Caddyfile на сайт (`:3211`) уходят только `/api/auth*`, `/.well-known/*`, `/bot/*`.

**Включить Telegram обратно.** Раскомментируйте сервисы `tma` и `bot` в `docker-compose.prod.yml`, блок
`tma` в `Caddyfile.prod`, кнопки входа в `apps/web`/`apps/admin` (помечены «switched off»), добавьте
DNS-запись `tma` и настройки Telegram в `CONVEX_ENV`. Серверу нужен доступ к `api.telegram.org`.

**Панель Convex просит пароль снова и снова.** Хэш в `.env` (`DASHBOARD_BCRYPT`) должен быть в
одинарных кавычках, как его записал `bootstrap.sh`. Пароль лежит в `dashboard-password.txt`
(если вы его уже удалили — сгенерируйте новый хэш:
`docker run --rm caddy:2-alpine caddy hash-password --plaintext '<пароль>'`).

**Образы не скачиваются.** Повторите `docker login ghcr.io`: токен должен иметь право `read:packages`.
