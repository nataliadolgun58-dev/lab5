# Caching HTTP Proxy Server

## Опис
Навчальний проєкт кешуючого HTTP-проксі-сервера,
створеного на Node.js з використанням модуля http.

## Технології
- Node.js
- HTTP
- Commander
- Superagent

## Можливості
- GET — отримання зображень із http.cat та кешування.
- PUT — збереження зображень у кеш.
- DELETE — видалення зображень із кешу.
- Обробка помилок HTTP-запитів.
- Повторне використання збережених зображень.

## Запуск

```bash
npm install
node main.js --host 127.0.0.1 --port 3000 --cache ./cache