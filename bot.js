/**
 * @author Nikita Dezzpil Orlov
 * @date 18.11.2013
 */

memwatch = require('memwatch');
config = require('./configs/config.json');
mongo = require('./drivers/mongo');
mysql = require('./drivers/mysql');
link = require('./link');
request = require('./request');
response = require('./response');
analyzer = require('./drivers/mocks/analyzer');
loggers = require('./drivers/loggers');
async = require('async');
util = require('util');
htmlparser2 = require("htmlparser2");
url = require('url');
LinkGuide = require('./libs/linkGuide');

loggerProcess = loggers.forge(
    config.loggers.process.type,
    config.loggers.process.options
);
loggerErrors = loggers.forge(
    config.loggers.errors.type,
    config.loggers.errors.options
);
loggerMemory = loggers.forge(
    "mongodb",{
        "db" : config.mongo.db,
        "host" : config.mongo.host,
        "port" : config.mongo.port,
        "username" : config.mongo.username,
        "password" : config.mongo.password,
        "timeout" : config.mongo.reconnectTimeout,
        "collection" : "log",
        "level" : "info",
        "silent" : false,
        "safe" : false
    }
);

try {
    process.stdout.setEncoding('binary');
} catch (e) {
    // whatever
}

process.on('uncaughtException', function(error) {
    if (util.isError(error)) {
        loggerErrors.error(error);
        loggerErrors.error(error.stack);
    } else {
        loggerErrors.error(error);
    }
});

process.on('SIGTERM', function () {

    // Disconnect from cluster master
    process.disconnect && process.disconnect();
    process.exit();

});

/**
 * Получить список ключей объекта
 * @todo вынести в отдельную библиотеку
 * @todo подключить свою либу (?)
 * @param {object} object
 * @returns {Array}
 */
function keys(object) {
    var keys = [], key;
    for (key in object) {
        keys.push(key);
    }

    return keys;
}

/**
 * Извлечь значение первого ключа объекта
 * @todo вынести в отдельную библиотеку
 * @todo подключить свою либу (?)
 * @param {object} object
 * @returns {*}
 */
function unshift(object) {
    var elem = null, i;
    for (i in object) {
        elem = object[i];
        delete(object[i]);
        break;
    }

    return elem;
}

function init() {

    var heapDiff, linkManager, requestManager,
        responseProcessor, analyzeFactory,
        botPID = parseInt(process.pid),
        crawlDeep = 0,
        linkMap = {},// сохраняем ссылки по всем итерациям, чтобы не посещать одни и те же страницы несколько раз
        options = {
            'config' : config,
            'logger' : loggerProcess,
            'pid' : botPID,
            'mysql' : mysql.driver,
            'mongo' : mongo.driver,
            'useragent' : config.name + ' v.' + config.version
        },
        guides = {},
        currentGuideBook = null;

    analyzeFactory = new analyzer.factory(options);

    responseProcessor = new response.factory(analyzeFactory, options);

    responseProcessor.on('response', function(bodyHtml) {

        // парсим тело ответа и сохраняем ссылки на внутренние
        // страницы сайта, добавляем их в путеводитель
        var parser, links = [],
            ignore_list = config.crawler.ignore,
            ignore_regexp = new RegExp("^\/$" + ignore_list.replace(/\|/g,"|\\.") + "|^#$|^#.{1,}$");

        parser = new htmlparser2.Parser({
            onopentag : function(name, attrs) {

                if (name != 'a') return;

                if (! ('href' in attrs)) return;

                if ('rel' in attrs && attrs.rel == 'nofollow' && config.crawler.perceive_nofollow) {
                    return;
                }

                if (attrs.href.match(ignore_regexp) == null) {

                    // избавляем текущую ссылку от ненужных частей
                    var currentDomain = currentGuideBook.getDomain();
                    if (currentGuideBook.getDomain().match(/^(?:http|https):\/\/(.+)/) != null) {
                        currentDomain = url.parse(currentGuideBook.getDomain()).hostname;
                    }

                    // иногда ссылки на странице указаны абсолютно
                    if (attrs.href.match(/^(?:http|https):\/\/(.+)/) != null) {

                        // и иногда это ссылки на внешние ресурсы, которые нас не интересуют
                        if (url.parse(attrs.href).hostname != currentGuideBook.getDomain()) {
                            return;
                        }
                    } else {
                        attrs.href = currentGuideBook.getDomain() + attrs.href;
                    }

                    // если ссылка еще не встречалась, мы сохраняем ее в список для гида
                    // и в индекс, чтобы в дальнейшем ее не проходить
                    if (!(attrs.href in linkMap)) {
                        links.push(attrs.href);
                        linkMap[attrs.href] = true;
                    }
                }

                /**
                 * @todo добавить проверку значений robots.txt, отдельная задача
                 */
            },
            'onend' : function() {

                guides[currentGuideBook.getDomain()] = LinkGuide.forge();

                for (var i in links) {
                    guides[currentGuideBook.getDomain()].addSub(currentGuideBook, links[i]);
                }

                console.log('save guide for %s', currentGuideBook.getDomain());
                console.log(guides[currentGuideBook.getDomain()].getIdMap());

            }
        });

        parser.write(bodyHtml);
        parser.end();

        return bodyHtml;
    });
    responseProcessor.on('encode', function(bodyEncoded) {
        return bodyEncoded;
    });

    requestManager = new request.manager(options, function(response, guideBook) {
        // we get response object here, may do what we want
        // we always can stop further process with
        // return guideBook.markLink();
        currentGuideBook = guideBook;

        var responser = new responseProcessor.create();
        responser.run(response, guideBook);
    });

    linkManager = new link.manager(options, function(guideBook) {

        // инициализируем запрос по гайдбуку
        requestManager.run(guideBook);

    });

    linkManager.on('start', function(guide) {

        // учет потребляемой памяти за итерацию
        heapDiff = new memwatch.HeapDiff();

        // Инициализация, гид не указан.
        // Получаем список адресов, создаем гида для их обхода,
        // только в случае, если нет существующего гида
        // ( мог быть создан во время сбора ссылок на уже пройденном сайте )
        // и вызываем менеджера ссылок для контроля работа гида
        if (crawlDeep <= config.crawler.deep && guides && keys(guides).length) {

            var guide = unshift(guides);
            crawlDeep++;
            linkManager.run(guide);

        } else {

            mysql.driver.getLinks(botPID, function(err, rows) {
                guide = LinkGuide.forge(rows);
                console.log('get new guide', guide.getIdMap());
                linkManager.run(guide);
            });

        }

    });

    linkManager.on('end', function(guide) {

        loggerMemory.info(heapDiff.end());

        mysql.driver.clearLinks(function(err, rows) {
            if (err) throw err;
        });

    });

    return linkManager;
}

async.parallel({
    'mysql' : function(callback) {
        mysql.driver.setLogger(loggerProcess)
            .setConfig(config.mysql)
            .connect(function(err) {
                callback(err, true);
            }
        );
    },
    'mongo' : function(callback) {
        mongo.driver.setLogger(loggerProcess)
            .setConfig(config.mongo)
            .connect(function(err) {
                callback(err, true);
            }
        );
    }
}, function(error, result) {

    loggerProcess.info(result);
    if (error) throw error;

    init().run();
});