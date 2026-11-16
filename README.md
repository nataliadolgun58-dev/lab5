# Caching HTTP Proxy Server

- GET — отримання зображень із http.cat та кешування.
- PUT — збереження зображень у кеш.
- DELETE — видалення зображень із кешу.
- Обробка помилок HTTP-запитів.
- Повторне використання збережених зображень.

npm install
node main.js --host 127.0.0.1 --port 3000 --cache ./cache
