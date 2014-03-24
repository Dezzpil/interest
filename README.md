# Crystal Interest Bot

Бот обходит ссылки из белого списка сайтов и пытается обнаружить насколько изменились страницы
с момента последнего прохода.

***

# Crystal Interest Bot Helper

Вспомогательный бот для трансформации слепков (impress документы из MongoDB)
в простой текст и сохранения этого текста в text документы в MongoDB с
дополнительными данными, необходимыми для передачи их в Sphinx через xmlpipe2

***

# Установка и запуск

## Подготовка

### NodeJS >=v0.10.23

[выбрать установку под систему]
(https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager)

[CentOS 6.5]
(https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager#rhelcentosscientific-linux-6)

### recode >= v3.6

    sudo yum install recode.i686
    
### Python v.2

    sudo yum install python-pip
    sudo pip install chardet

    sudo yum install gcc python-devel
    sudo yum install pymongo
    sudo yum install python-lxml.i686

### MySQL

работает с Crawler.domain
можно использовать дамп из папки examples/

    mysql -h localhost -u root -p
    CREATE DATABASE IF NOT EXISTS Crawler DEFAULT CHARACTER SET utf8

    mysql -h localhost -u root -p Crawler < examples/domain20140113.sql

### MongoDB :

[download](http://www.mongodb.org/downloads)

использует 4 коллекции (все коллекции Mongo создает само (автоматически)):
+  log - для хранения снимков памяти
+  impresses - для хранения тела http ответов
+  ferry_tasks - для хранения ссылок проработанных http запросы
+  texts - для хранения текста, извлеченного из тела http запроса

## Установка

    git pull
    git submodule init
    git submodule update
    mkdir -m 775 logs
    mkdir configs
    cp examples/mysqlMockData.json configs/mysqlMockData.json
    cp examples/config.json configs/config.json
    nano configs/config.json

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

## Запуск

    npm start

Для пертых чуваков, которые будут это поддерживать, есть и другой путь.
Проверка работы (npm test вызывает этот скрипт, см. package.json):

    node tests/runner.js

Запустить только бота:

    node bot.js

Запуситить только помощника:

    node helper.js

Сводку о результатах работы бота можно увидеть:

    node utils/statsDataFromDB.js

Если необходимо обнулить результаты работы бота, т.е. снять отметки о работе
в MySQL Crawler.domain и удалить все документы в рабочих коллекциях MongoDB:

    node utils/resetAllDataFromDB.js

## Sphinx

Файл конфигурации examples/sphinx-mongo.conf настроен на работу через xmlpipe2 и содержит 2 индекса.

    cd sphinx
    mkdir configs
    cp examples/sphinx-mongo.conf configs/sphinx-mongo.conf
    cp examples/config.json configs/config.json

Xmlpipe2 использует xmltexts.py, который формирует xml с config.json:xmlpipe2.documentsNumEachExec
документов, которые еще не были проиндексированы ранее.

    nano configs/config.json

Секции source & index надо включить в боевой конфиг sphinx'a.
Для локальных проверок можно запускать конфиг из файлов проекта с предустановленными настройками,
но ПЕРЕПИСАТЬ ПУТИ СФИНКСА!

После включения секций, описывающих новые индексы надо подхватить новые конфиги:

    sudo searchd --stop
    sudo searchd --config %your_config%

Индексируем индексы:

    indexer --all --verbose --rotate --config %your_config%

Для проверки подключаемся к sphinx'y:

    mysql -h 127.0.0.1 -P 3312
    show tables;

В списке должны быть:

    | crystalkids27_sites_mongo  | local |
    | crystalkids712_sites_mongo | local |

## Upstart

[upstart - event-based init daemon](http://upstart.ubuntu.com/)

Для управления ботом как процессом можно использовать скрипт upstart/interest-bot.conf
он очень простой: проверяет пройдены ли тесты, и если да - запускает скрипт upstart/interest-bot, который автоматически запускает
необходимые процессы для бота.

Можно использовать отдельного пользователя для работы.

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


