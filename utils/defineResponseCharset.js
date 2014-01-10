/**
 * Created by dezzpil on 22.12.13.
 *
 * send request to local domains (utf8.interest.bot, cp1251.interest.bot and so on)
 * in queue and get response. Then try to find out what encoding we got.
 * Try to convert it to utf-8
 *
 * @todo Перенести в утилс/ Использовать модуль из респонсь.жс,
 * чтобы определять кодировку сайтов
 */

var config = require('./../configs/config.json'),
    loggers = require('./../drivers/loggers').forge(0),

    // base work flow
    response = require('./../response'),
    responseFactory = (new response.factory()),

    request = require('./../request'),
    requestManager = (new request.manager()),

    links = require('./../link'),
    linksManager = (new links.manager()),

    // mocks
    mongoMockDriver = require('./../drivers/mocks/mongo').driver,
    mysqlMockDriver = require('./../drivers/mocks/mysql').driver,
    analyzerMockFactory = require('./../drivers/mocks/analyzer').factory;

// inject
mongoMockDriver
    .setConfig(config.mongo)
    .setLoggers(loggers);

mysqlMockDriver
    .setConfig(config.mysql)
    .setLoggers(loggers);

responseFactory
    .setOptions(config)
    .setLoggers(loggers)
    .setBotPID('mock')
    .setMysqlDriver(mysqlMockDriver)
    .setMongoDriver(mongoMockDriver)
    .setAnalyzerFactory(analyzerMockFactory);

requestManager
    .setOptions(config)
    .setLoggers(loggers)
    .setMysqlDriver(mysqlMockDriver)
    .setUserAgent(config.name + ' v.' + config.version)
    .setModel(function(response, guideBook) {

        var responseHandle = new responseFactory.create();
        responseHandle.run(response, guideBook);

    });

linksManager
    .setLoggers(loggers)
    .setOptions(config)
    .setMysqlDriver(mysqlMockDriver)
    .setBotPID('mock')
    .setOnIterateStart(function(guide) {

        loggers.file.info('starting iteration');

    })
    .setRequestManager(function(guideBook) {

        requestManager.run(guideBook);
    })
    .setOnIterateFin(function(guide) {

        process.exit();

    });

// go
linksManager.run();