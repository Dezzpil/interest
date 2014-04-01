/**
 * @author Nikita Dezzpil Orlov
 * @date 18.11.2013
 */

var memwatch            = require('memwatch');
var async               = require('async');
var util                = require('util');
var config              = require('./configs/config.json');

(function(){

    var obj                 = require('./libs/object');
    var PageStorageDriver   = require('./drivers/mongo');
    var DomainStorageDriver = require('./drivers/mysql');
    var AnalyzeDriver       = require('./drivers/analyze/node');
    var LoggerDriver        = require('./drivers/loggers');
    var RequestManager      = require('./request');
    var ResponseManager     = require('./response');
    var LinksManager        = require('./link');
    var LinksGuide          = require('./libs/linksGuide');
    var LinksCollector      = require('./collector/links');
    var TextsCollector      = require('./collector/texts');
    var PageSaver           = require('./pagesaver');

    var botPID = parseInt(process.pid);

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

    var pageStorage = null;
    var domainStorage = null;
    var storageOptions = {
        'logger' : loggerProcess,
        'config' : config
    };

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

        // TODO remove it to upstart/interest-bot
        // unlock all links
        domainStorage.unlockLinks(null);

        // Disconnect from cluster master
        process.disconnect && process.disconnect();
        process.exit();

    });

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
        }
    }, function(error, result) {

        loggerProcess.info(result);
        if (error) throw error;

        init();
    });


    /**
     * Инициализировать
     * параметры и начать работу
     */
    function init() {

        var heapDiff, linksManager, linksCollector,
            requester, responser,
            textsCollector, analyzeDriver,
            saver, options = {
                'config' : config,
                'logger' : loggerProcess,
                'pid' : botPID,
                'mysql' : domainStorage,
                'mongo' : pageStorage,
                'useragent' : config.name + ' v.' + config.version
            },
            guides = {},
            currentGuideBook = null;             // guidebook в работе

        // объект управляющий сохранением и завершением работы с
        // гайдбуком по разным причинам, настраивается в зависимости от
        // ситуации
        saver = new PageSaver(options);

        analyzeDriver = new AnalyzeDriver(options);
        analyzeDriver.on('complete', function(data) {
            saver.setAnalyzeResult(data);
            saver.save();
        });
        analyzeDriver.on('error', function(err) {
            saver.setAnalyzeResult(analyzeDriver.getDummyResult());
            saver.save();
        });

        linksCollector = new LinksCollector(options);
        linksCollector.on('collected', function(links) {
            if (links && links.length) {
                guides[currentGuideBook.getDomain()] = new LinksGuide();

                for (var i in links) {
                    guides[currentGuideBook.getDomain()].addSub(currentGuideBook, links[i]);
                }
            }
        });
        linksCollector.on('error', function(err) {
            //
        });

        textsCollector = new TextsCollector();
        textsCollector.on('collected', function(text) {

            saver.setText(text);

            pageStorage.findPagesById(currentGuideBook.getIdD(), function(err, result) {
                if (err == null && result.length > 0) {
                    analyzeDriver.setPrevText(result[0].content);
                } else {
                    analyzeDriver.setPrevText(text);
                }
            });

            analyzeDriver.setNewText(text);
        });
        textsCollector.on('error', function(err) {
            loggerProcess.info('%s error while collecting text', currentGuideBook.getIdD(), err);
            currentGuideBook.markLink();
        });

        responser = new ResponseManager(options);
        responser.on('recode', function(bodyRecoded) {
            linksCollector.parseHTML(bodyRecoded);
            textsCollector.parseHTML(bodyRecoded);
        });

        requester = new RequestManager(options);
        requester.on('success', function(data) {

            // we get response object here, may do what we want
            // we always can stop further process with
            // return guideBook.markLink();

            var response = data.response,
                guidebook = data.guidebook;

            currentGuideBook = guidebook;

            saver.setGuideBook(guidebook);
            saver.setStatusCode(response.statusCode + '');

            linksCollector.setGuideBook(guidebook);
            responser.run(response, guidebook);
        });

        linksManager = new LinksManager(options, function(guideBook) {
            // инициализируем запрос по гайдбуку
            requester.run(guideBook);
        });
        linksManager.on('start', function(guide) {

            // учет потребляемой памяти за итерацию
            heapDiff = new memwatch.HeapDiff();

            // Инициализация, гид не указан.
            // Получаем список адресов, создаем гида для их обхода,
            // только в случае, если нет существующего гида
            // ( мог быть создан во время сбора ссылок на уже пройденном сайте )
            // и вызываем менеджера ссылок для контроля работа гида
            if (guides && Object.keys(guides).length) {

                var guide = obj.unshift(guides);
                loggerProcess.info('collect links for guide', guide.getList());
                linksManager.run(guide);

            } else {

                domainStorage.getLinks(botPID, function(err, rows) {
                    guide = new LinksGuide(rows);
                    loggerProcess.info('get new guide', guide.getList());
                    linksManager.run(guide);
                });

            }

        });
        linksManager.on('end', function(guide) {

            loggerMemory.info(heapDiff.end());
            domainStorage.unlockLinks(botPID, function(err, rows) {
                if (err) throw err;
            });

        });

        linksManager.run();
    }

})();