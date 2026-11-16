
import http from 'node:http';
import path from 'node:path';
import {
    mkdir,
    readFile,
    writeFile,
    unlink
} from 'node:fs/promises';

import { once } from 'node:events';
import { program } from 'commander';
import superagent from 'superagent';

// 1. Налаштування параметрів командного рядка
program
    .helpOption('-?, --help', 'Показати довідку')
    .requiredOption('-h, --host <address>', 'Адреса сервера')
    .requiredOption(
        '-p, --port <number>',
        'Порт сервера',
        Number
    )
    .requiredOption(
        '-c, --cache <path>',
        'Шлях до теки кешу'
    );

program.parse(process.argv);

const options = program.opts();

const host = options.host;
const port = options.port;
const cacheDir = path.resolve(options.cache);

// Перевірка правильності порту
if (
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
) {
    throw new Error('Порт повинен бути числом від 1 до 65535');
}

// 2. Отримання коду стану з URL
function getStatusCode(url) {
    const pathname = new URL(
        url,
        'http://localhost'
    ).pathname;

    const match = pathname.match(/^\/(\d{3})\/?$/);

    if (!match) {
        return null;
    }

    const code = Number(match[1]);

    if (code < 100 || code > 599) {
        return null;
    }

    return String(code);
}

// 3. Отримання тіла HTTP-запиту
async function readRequestBody(req) {
    const chunks = [];

    for await (const chunk of req) {
        chunks.push(chunk);
    }

    return Buffer.concat(chunks);
}

// 4. Відправлення текстової відповіді
function sendText(res, statusCode, message, headers = {}) {
    res.writeHead(statusCode, {
        'Content-Type': 'text/plain; charset=utf-8',
        ...headers
    });

    res.end(message);
}

// 5. Відправлення картинки
function sendImage(res, image, source) {
    res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Content-Length': image.length,
        'X-Cache': source
    });

    res.end(image);
}

// 6. Створення HTTP-сервера
const server = http.createServer(async (req, res) => {
    try {
        // Перевірка HTTP-методу
        const allowedMethods = ['GET', 'PUT', 'DELETE'];

        if (!allowedMethods.includes(req.method)) {
            return sendText(
                res,
                405,
                'Method Not Allowed',
                { 'Allow': 'GET, PUT, DELETE' }
            );
        }

        // Отримання коду стану з URL
        const code = getStatusCode(req.url);

        if (!code) {
            return sendText(res, 404, 'Image not found');
        }

        // Формування шляху до файлу кешу
        const filePath = path.join(
            cacheDir,
            `${code}.jpg`
        );

        // 7. Обробка GET-запиту
        if (req.method === 'GET') {
            let image;

            // Перевірка наявності картинки в кеші
            try {
                image = await readFile(filePath);

                console.log(`Cache HIT: ${code}`);

                return sendImage(res, image, 'HIT');

            } catch (error) {
                if (error.code !== 'ENOENT') {
                    throw error;
                }
            }

            // Якщо картинки немає в кеші,
            // отримуємо її зі стороннього сервера
            try {
                const response = await superagent
                    .get(`https://http.cat/${code}`)
                    .buffer(true);

                image = response.body;

                if (!Buffer.isBuffer(image) || image.length === 0) {
                    return sendText(
                        res,
                        404,
                        'Image not found'
                    );
                }

            } catch (error) {
                console.error(
                    'Помилка запиту до http.cat:',
                    error.message
                );

                return sendText(
                    res,
                    404,
                    'Image not found'
                );
            }

            // Збереження отриманої картинки в кеші
            await writeFile(filePath, image);

            console.log(`Cache MISS: ${code}`);

            return sendImage(res, image, 'MISS');
        }

        // 8. Обробка PUT-запиту
        if (req.method === 'PUT') {
            const image = await readRequestBody(req);

            if (image.length === 0) {
                return sendText(
                    res,
                    400,
                    'Request body is empty'
                );
            }

            // Запис або заміна картинки в кеші
            await writeFile(filePath, image);

            console.log(`Image saved: ${code}`);

            return sendText(
                res,
                201,
                'Image successfully saved'
            );
        }

        // 9. Обробка DELETE-запиту
        if (req.method === 'DELETE') {
            try {
                await unlink(filePath);

                console.log(`Image deleted: ${code}`);

                return sendText(
                    res,
                    200,
                    'Image successfully deleted'
                );

            } catch (error) {
                if (error.code === 'ENOENT') {
                    return sendText(
                        res,
                        404,
                        'Image not found in cache'
                    );
                }

                throw error;
            }
        }

    } catch (error) {
        console.error('Помилка сервера:', error);

        if (!res.headersSent) {
            sendText(
                res,
                500,
                'Internal Server Error'
            );
        } else {
            res.destroy();
        }
    }
});

// 10. Запуск сервера
async function startServer() {
    // Створення теки кешу, якщо вона відсутня
    await mkdir(cacheDir, { recursive: true });

    console.log(`Тека кешу: ${cacheDir}`);

    // Запуск сервера
    server.listen(port, host);

    await once(server, 'listening');

    console.log(
        `Сервер запущено: http://${host}:${port}`
    );
}

// Обробка помилок запуску
try {
    await startServer();
} catch (error) {
    console.error(
        'Не вдалося запустити сервер:',
        error.message
    );

    process.exitCode = 1;
}
