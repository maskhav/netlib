# netlib

Бібліотека мережевих конфіг-шаблонів з плейсхолдерами. PWA: працює офлайн,
тягне останній реліз шаблонів з цього репо, пушить твої зміни через GitHub API.

## Структура

```
templates/<вендор>/<імʼя>.tpl   шаблони (бібліотека)
docs/                            сама програма (GitHub Pages)
tools/embed-demo.mjs             вбудовує templates/ у програму як демо
deploy/                          розгортання на своєму домені (nginx, cloudflared)
```

## Формат шаблону

```
---
title: eBGP пір з фільтрами
vendor: cisco-iosxe
tags: [bgp, ebgp]
verify:
  - show ip bgp neighbors {{peer_ip}} received-routes
notes: |
  Підводні камені, навіщо цей блок.
vars:
  peer_ip: {type: ipv4, hint: "IP сусіда", example: 192.0.2.1}
  pl_in:   {type: word, hint: "Prefix-list на вхід", default: PL-ISP-IN}
---
router bgp {{local_as}}
 neighbor {{peer_ip}} remote-as {{peer_as}}
```

Змінні `{{name}}` сумісні з Jinja2. Однакові імена заповнюються один раз.
Типи для перевірки: `ipv4 ipv6 ip cidr mask asn int mac word text`,
для чисел можна додати `range: 1-4094`. Рядки, що починаються з `!` або `#`,
показуються як коментарі. Вкладені елементи в заголовку відступаються пробілами.

## Запуск

1. Створи репо (можна приватне), закинь туди цю папку.
2. Settings → Pages → Deploy from branch → `main`, папка `/docs`.
3. Відкрий сторінку, в меню браузера «Встановити застосунок».
4. Створи реліз (наприклад `v0.1.0`), щоб програма мала що синхронізувати.
5. У налаштуваннях програми: `owner/repo`, джерело, гілка для push, токен.

Токен: GitHub → Settings → Developer settings → Fine-grained tokens,
доступ тільки до цього репо, Repository permissions → Contents: Read and write.
Для приватного репо токен потрібен і для синхронізації.

## Робочий цикл

- Відкрив шаблон, заповнив поля прямо в коді, Copy.
- «Зробити свій» створює копію як чернетку, «Редагувати» змінює цей шаблон.
- Чернетки живуть на пристрої, Push відправляє їх у гілку, коли є мережа.
- Коли набралось змін, створюєш реліз, і всі пристрої підтягнуть його.

Після змін у `docs/app.js` або `index.html` підніми `VERSION` у `docs/sw.js`.
Після змін у `templates/` за бажанням онови демо: `node tools/embed-demo.mjs`.

## Свій домен з автентифікацією (Cloudflare Tunnel + Access)

```
cd deploy && docker compose up -d        # nginx на 127.0.0.1:8088
```

1. Додай правило з `deploy/cloudflared-ingress.yml` у `/etc/cloudflared/config.yml`,
   потім `cloudflared tunnel route dns <tunnel> netlib.havinson.com` і `systemctl restart cloudflared`.
2. Zero Trust → Access → Applications → Self-hosted, домен `netlib.havinson.com`,
   політика Allow → Emails → твоя пошта. Логін: One-time PIN або GitHub.
3. Session duration постав довгу (наприклад 1 місяць), щоб не логінитись щоразу.

Оновлення програми: `git pull` у репо на сервері, nginx віддає `docs/` напряму.

## Свій домен з автентифікацією (homelab)

Схема: `телефон → Cloudflare Access (логін) → cloudflared → nginx 127.0.0.1:8088`.
nginx віддає `docs/` і проксіює `/api/gh/` у GitHub, підставляючи токен.
Токен живе тільки на сервері, проксі пропускає лише цей один репозиторій.

1. `cp deploy/secrets/github-token.conf.example deploy/secrets/github-token.conf`,
   встав токен, `chmod 600`. Проксі в `deploy/nginx/netlib.conf` вже налаштований на `maskhav/netlib`.
2. `cd deploy && docker compose up -d`
3. Додай рядки з `deploy/cloudflared-ingress.yml` у `/etc/cloudflared/config.yml`,
   `cloudflared tunnel route dns <імʼя_тунелю> netlib.havinson.com`, `systemctl restart cloudflared`.
4. Cloudflare Zero Trust → Access → Applications → Self-hosted, домен `netlib.havinson.com`,
   політика Allow на свою пошту або GitHub-логін. Session duration: 1 month.
5. У програмі: Доступ до GitHub → «Через мій сервер», адреса `/api/gh`, токен не потрібен.

Оновлення програми на сервері: `git pull` у репо (руками, cron або вебхук з n8n).

## Як поводиться онлайн і офлайн

| Ситуація | Що відбувається |
|---|---|
| Онлайн, сесія активна | Автосинхронізація при старті, push одразу |
| Онлайн, сесія Access закінчилась | Відкриття сторінки веде на логін. Сторінка логіну не потрапляє в кеш |
| Офлайн | Оболонка з кешу, бібліотека й чернетки з IndexedDB, логін не потрібен |
| Push офлайн | Чернетка стає «в черзі», відправляється сама, коли зʼявиться мережа |
| Конфлікт при автопуші | Нічого не перезаписується, чернетка позначається «конфлікт» |
| Взагалі без інтернету на обʼєкті | Експорт у файл → перенести → імпорт. Окремі .tpl імпортуються як чернетки |

Встановлену програму варто хоч раз відкрити онлайн після кожного оновлення, щоб кеш підтягнув нову версію.
