# Interest WEB-Bot

Структура для быстрого старта в разработке веб-бота на NodeJS.

## Установка и запуск

### Требования

1. NodeJS >=v0.10.23
2. recode >= v3.6
3. Python ~2.7

## Установка

В configs/config.json прописать правильные пути до директории бота,
для подключения к базам данных, анализатору.

Можно настроить логирование в секции loggers. Секция поделена на 2 подсекции,
process - логирует последовательность выполнения, а errors - ошибки выполнения.
Для каждой из этих подсекций можно выбрать транспорт модуля winston и определить
настройки самостоятельно.
Сейчас поддерживаются транспорты из [Winston Core](https://github.com/flatiron/winston/blob/master/docs/transports.md#http-transport)

    npm install

Если во время установки возникает ошибка Error: SELF_SIGNED_CERT_IN_CHAIN то
нужно внести изменения в конфигурацию npm и перезапустить установку:

    npm config set strict-ssl false
    npm install

Теперь проверяем все ли на месте и настроено как надо:

    npm test

### Запуск

    npm start

Для пертых чуваков, есть и другой путь.
Проверка работы (npm test вызывает этот скрипт, см. package.json):

    node tests/runner.js

Запустить только бота:

    node worker.js

## Примеры использования



## Upstart

[upstart - event-based init daemon](http://upstart.ubuntu.com/)

Для управления ботом как процессом можно использовать скрипт upstart/interest-bot.conf
он очень простой: проверяет пройдены ли тесты, и если да - запускает скрипт upstart/interest-bot, который автоматически запускает
необходимые процессы для бота.

Нужно(sic!) использовать отдельного пользователя для работы.

    initctl --version # версия upstart

    cp upstart/upstart.0.6.conf /etc/init/interest-bot.conf # ver. >= 0.6.5
    cp upstart/upstart.1.10.conf /etc/init/interest-bot.conf # ver. >= 1.10

    cd /etc/init/
    vim interest-bot.conf
    start interest-bot
    # interest-bot start/running, process N

Логирование статуса задачи происходит в logs/upstart.log. Задача запускает npm test
перед стартом бота - logs/npmtest.log.

Upstart позволяет перезагрузить бота. При перезагрузке config/config.json подтягивается заново.

    restart interest-bot

Чтобы остановить бота

    stop interest-bot
