/**
 * @author Nikita Dezzpil Orlov
 * @date 18.11.2013
 */

var memwatch            = require('memwatch');
var async               = require('async');
var util                = require('util');

(function(){

    var RequestManager      = require('./request');
    var response            = require('./response');
    var obj                 = require('./libs/object');
    var config              = require('./configs/config.json');
    var PageStorageDriver   = require('./drivers/mongo');
    var DomainStorageDriver = require('./drivers/mysql');
    var AnalyzerFactory     = require('./drivers/analyze/node');
    var LoggerFactory       = require('./drivers/loggers');
    var LinksManager        = require('./link');
    var LinksCollector      = require('./collector/links');
    var LinksGuide          = require('./libs/linksGuide');
    var TextsCollector      = require('./collector/texts');

    var botPID = parseInt(process.pid);

    var loggerProcess = LoggerFactory.forge(
        config.loggers.process.type,
        config.loggers.process.options
    );
    var loggerErrors = LoggerFactory.forge(
        config.loggers.errors.type,
        config.loggers.errors.options
    );
    var loggerMemory = LoggerFactory.forge(
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
            requestManager, textsCollector,
            responseProcessor, analyzeFactory,
            options = {
                'config' : config,
                'logger' : loggerProcess,
                'pid' : botPID,
                'mysql' : domainStorage,
                'mongo' : pageStorage,
                'useragent' : config.name + ' v.' + config.version
            },
            guides = {},
            currentGuideBook = null;

        analyzeFactory = new AnalyzerFactory(options);
        analyzeFactory.on('error', function(err) {
            console.log('analyzeFactory error', err)
        });

        analyzeFactory.on('success', function(data) {
            console.log('analyzeFactory', data);
        });

        responseProcessor = new response.factory(analyzeFactory, options);

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

            // start analyzer work
            analyzeFactory.write(text);
            analyzeFactory.end(text);

        });
        textsCollector.on('error', function(err) {
           //
        });


        responseProcessor.on('response', function(bodyHtml) {
            return bodyHtml;
        });
        responseProcessor.on('recode', function(bodyEncoded) {

            linksCollector.parseHTML(bodyEncoded);
            textsCollector.parseHTML(bodyEncoded);

            return bodyEncoded;
        });

        requestManager = new RequestManager(options, function(response, guideBook) {
            // we get response object here, may do what we want
            // we always can stop further process with
            // return guideBook.markLink();
            currentGuideBook = guideBook;
            linksCollector.setGuideBook(guideBook);

            var responser = new responseProcessor.create();
            responser.run(response, guideBook);
        });

        linksManager = new LinksManager(options, function(guideBook) {
            // инициализируем запрос по гайдбуку
            requestManager.run(guideBook);
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
                console.log('collect links for guide', guide.getList());
                linksManager.run(guide);

            } else {

                domainStorage.getLinks(botPID, function(err, rows) {
                    guide = new LinksGuide(rows);
                    console.log('get new guide', guide.getList());
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