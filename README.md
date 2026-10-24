# Театр новых возможностей

Статичный сайт театра: `index.html`, `styles.css`, `script.js`.

## Контент

Всё, что меняется на сайте, лежит в папке `content/`:

- `content/afisha.json` — даты показов и ссылки на билеты (прошедшие скрываются автоматически);
- `content/shows.json` — спектакли: описание, постер, создатели, актёры, фото (страница `spektakl.html?id=…`);
- `content/news.json` — новости с фото и ссылками на прессу (страница `novost.html?id=…`);
- `content/settings.json` — тексты, цифры, проекты и контакты.

Фото, загруженные через админку, попадают в `assets/uploads/`.

## Админка

Панель управления открывается по адресу `https://<адрес-сайта>/admin` (Decap CMS).
Войти может только тот, у кого есть доступ на запись к репозиторию `virtualofficialgm-ux/clod` на GitHub.
Каждое сохранение в админке — это коммит в ветку `main`; сайт обновляется сам за 1–2 минуты.

Подключение (один раз):

1. Залить сайт на Netlify из репозитория (ветка `main`, папка публикации — корень, команда сборки не нужна).
2. На GitHub: Settings → Developer settings → OAuth Apps → New OAuth App.
   Callback URL: `https://api.netlify.com/auth/done`. Скопировать Client ID и Client Secret.
3. На Netlify: Site configuration → Access & security → OAuth → Install provider → GitHub, вставить ID и Secret.

## Локальный просмотр

Из-за загрузки `content/*.json` сайт нужно открывать через локальный сервер:
`python3 -m http.server` и затем `http://localhost:8000`.
Файл `dist/teatr-novyh-vozmozhnostey.html` — то же самое одним файлом с встроенным контентом, открывается двойным щелчком.
