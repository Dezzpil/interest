/**
 * @author Nikita Dezzpil Orlov
 * @date 18.11.2013
 */

var async               = require('async');
var util                = require('util');
var memwatch            = require('memwatch');

var config              = require('./configs/config.json');
var RequestManager      = require('./manager/request');
var ResponseManager     = require('./manager/response');
var LinksManager        = require('./manager/link');
var PageManager         = require('./manager/page');
var AnalyzeDriver       = require('./driver/analyze/node');
var LoggerDriver        = require('./driver/loggers');
var LinksGuide          = require('./lib/linksGuide');
var LinksCollector      = require('./collector/links');
var TextsCollector      = require('./collector/texts');

if (config.debugmode >= 1) {
	var DomainStorageDriver = require('./driver/mocks/mysql');
} else {
	var DomainStorageDriver = require('./driver/mysql');
}

if (config.debugmode >= 2) {
	var PageStorageDriver   = require('./driver/mocks/mongo');
} else {
	var PageStorageDriver   = require('./driver/mongo');
}

try { process.stdout.setEncoding('binary'); } catch (e) {}

var botPID = parseInt(process.pid);
var pageUid = 0;

// Логгеры для процесса работы

var loggerProcess = LoggerDriver.forge(
    config.loggers.process.type,
    config.loggers.process.options
);
var loggerErrors = LoggerDriver.forge(
    config.loggers.errors.type,
    config.loggers.errors.options
);
var loggerMemory = LoggerDriver.forge(
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

process.on('uncaughtException', function(error) {
    if (util.isError(error)) {
        loggerErrors.error(error);
        loggerErrors.error(error.stack);
        process.exit(1);
    } else {
        loggerErrors.error(error);
    }
});

// Установка соединения с базами
var pageStorage = null;
var domainStorage = null;
var storageOptions = {
    'logger' : loggerProcess,
    'config' : config
};

async.parallel({
    'domain' : function(callback) {
        domainStorage = new DomainStorageDriver(storageOptions);
        domainStorage.connect(function(err) {
            callback(err, true);
        });
    },
    'page' : function(callback) {
        pageStorage = new PageStorageDriver(storageOptions);
        pageStorage.connect(function(err) {
            callback(err, true);
        });
    },
    'page_uid' : function(callback) {
        // объект управляющий сохранением и завершением работы с
        // гайдбуком по разным причинам, настраивается в зависимости от
        // ситуации
        pageStorage.findPageWithMaxUid(function(err, page) {
            if (page && page.uid >= 0) pageUid = page.uid;
            callback(err, pageUid);
        });
    }
}, function(error, result) {

    loggerProcess.info(result);
    if (error) throw error;


    process.on('SIGTERM', function () {

        // unlock all links
        domainStorage.unlockLinks(null);

        // Disconnect from cluster master
        //process.disconnect && process.disconnect();
        process.exit();

    });

    // загрузка и запуск процесса работы
    (function() {

        var heapDiff, linksManager, linksCollector,
            requester, responser, analyzeDriver,
            textsCollector, page, guides = [],
            options = {
                'config' : config,
                'logger' : loggerProcess,
                'pid' : botPID,
                'mysql' : domainStorage,
                'mongo' : pageStorage
            };

        page = new PageManager(options, pageUid);

        linksCollector = new LinksCollector(options);

        linksCollector.on('collected', function(guidebook, links) {

            loggerProcess.info('%s LINKS COLLECTED', guidebook.getIdD(), links);

            if (links && links.length) {
                var i, c = 0;
                // делим собранные ссылки на гид, в соотв.
                // с указанным в конфиге количеством элементов
                // для каждой итерации
                guides.push(new LinksGuide());
                for (i in links) {
                    c++;
                    if (c >= config.iteration.count) {
                        guides.push(new LinksGuide());
                        c = 0;
                    }

                    guides[guides.length - 1].addSub(guidebook, links[i], i);
                }

            }
        });

        linksCollector.on('error', function(guidebook, err) {
            loggerProcess.info('%s LINKS COLLECTING ERROR', guidebook.getIdD(), err);
        });

        analyzeDriver = new AnalyzeDriver(options);

        textsCollector = new TextsCollector();

        textsCollector.on('collected', function(guidebook, text, title) {

            var prevText = '';

            loggerProcess.info('%s TEXT COLLECTED', guidebook.getIdD());

            pageStorage.findPagesById(guidebook.getIdD(), function(err, result) {

                prevText = text;
                if (err == null && result.length > 0) {
                    loggerProcess.info('%s PREV TEXT FOUND', guidebook.getIdD());
                    prevText = result[0].content;
                }

                loggerProcess.info('%s SEND TEXT TO ANALYZED', guidebook.getIdD());

                analyzeDriver.run(text, prevText, function(result, err) {

                    loggerProcess.info('%s TEXT ANALYZED', guidebook.getIdD(), result);
                    if (err) loggerProcess.info('%s TEXT ANALYZING ERROR', guidebook.getIdD(), err);

                    guidebook.markLink(function() {
                        page.save(guidebook, text, title, result, 200);
                    });
                });
            });
        });

        textsCollector.on('error', function(guidebook, err) {
            loggerProcess.info('%s TEXTCOLLECTOR: ERROR', guidebook.getIdD(), err);
            guidebook.markLink(function() {
                domainStorage.setStatusForLink(guidebook, config.codes.htmlParseError, function(err, rows) {
                    if (err) throw err;
                    loggerProcess.info('%s MYSQL ROW UPDATED WITH TEXT PARSE ERROR', guidebook.getIdD());
                });
            });
        });

        responser = new ResponseManager(options);

        responser.on('received', function(guidebook, bodyHTML, callback) {
            callback(guidebook, bodyHTML);
        });

        responser.on('recoded', function(guidebook, bodyRecoded) {
            linksCollector.parseHTML(guidebook, bodyRecoded);
            textsCollector.parseHTML(guidebook, bodyRecoded);
        });

        requester = new RequestManager(options);

        requester.on('response', function(guidebook, response) {
            responser.run(response, guidebook);
        });

        linksManager = new LinksManager(options, function(guideBook) {
            // инициализируем запрос по гайдбуку
            requester.run(guideBook);
        });

        linksManager.on('empty', function() {
            // Инициализация, гид не указан.
            // Получаем список адресов, создаем гида для их обхода,
            // только в случае, если нет существующего гида
            // ( мог быть создан во время сбора ссылок на уже пройденном сайте )
            // и вызываем менеджера ссылок для контроля работа гида
            if (guides.length) {

                var guide = guides.shift();
                loggerProcess.info('ITERATION: GET SUBLINKS', guide.getList());
                linksManager.run(guide);

            } else {

                // чтобы очистить кэш ссылок
                linksCollector.clearCache();

                domainStorage.getLinks(botPID, config.iteration.count, function(err, rows) {
                    loggerProcess.info('ITERATION: GET LINKS');
                    guide = new LinksGuide(rows);
                    linksManager.run(guide);
                });

            }
        });

        linksManager.on('start', function(guide) {
            loggerProcess.info('ITERATION: START');
            // учет потребляемой памяти за итерацию
            heapDiff = new memwatch.HeapDiff();
        });

        linksManager.on('terminated', function(guide) {
            var ready, notready, diff = [], i;
            ready = guide.getReadyList();
            notready = guide.getList();

            for (i in notready) {
                if (ready.indexOf(notready[i]) == -1) {
                    diff.push(notready[i]);
                }
            }

            loggerProcess.info('ITERATION: TERMINATED WITH', diff);
            linksManager.emit('end', guide);

            var delay = setTimeout(function() {
                clearTimeout(delay);
                linksManager.run();
            }, 1000)
        });

        linksManager.on('end', function(guide) {
            loggerProcess.info('ITERATION: END');
            try {
                loggerMemory.info(heapDiff.end());
            } catch (e) {

            }
            domainStorage.unlockLinks(botPID, function(err, rows) {
                if (err) throw err;
            });
        });

        linksManager.run();
    })();
});
