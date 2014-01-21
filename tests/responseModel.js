/**
 * npm test
 * Created by dezzpil on 22.12.13.
 *
 * Все драйверы ничего не сохраняют и не запрашивают,
 * для запроса предоставляются тестовые данные из configs/mysqlMockData.json,
 * по полученным ссылкам выполяются запросы, полученные данные обрабатываются
 * рабочим модулем responseFactory, в который входит работа с кодировками, с
 * mock-оберткой над analyzer'ом. Взаимодействие с самим analyzer не проверяется.
 */

var config = require('./../configs/config.json'),
    util = require('util'),
    path = require('path'),
    scriptName = path.basename(process.cwd(), '.js'),

    response = require('./../response'),
    responseFactory = (new response.factory()),

    request = require('./../request'),
    requestManager = (new request.manager()),

    links = require('./../link'),
    linksManager = (new links.manager()),

    mongoMockDriver = require('./../drivers/mocks/mongo').driver,
    mysqlMockDriver = require('./../drivers/mocks/mysql').driver,
    analyzerMockFactory = require('./../drivers/mocks/analyzer').factory,

    loggers = require('./../drivers/loggers'),
    loggerSimple = loggers.forge( "console", { level : "info", colorize: true }),
    loggerErrors = loggers.forge( "console", { level : "error", colorize : true });


process.on('uncaughtException', function(error) {
    if (util.isError(error)) {
        loggerErrors.error(error.toString());
    } else {
        loggerErrors.error(error);
    }

    process.exit();
});


loggerSimple.info('%s : start checking', scriptName);


// inject
mongoMockDriver
    .setConfig(config.mongo)
    .setLogger(loggerSimple);

mysqlMockDriver
    .setConfig(config.mysql)
    .setLogger(loggerSimple);

responseFactory
    .setConfig(config)
    .setLogger(loggerSimple)
    .setBotPID(parseInt(process.pid))
    .setMysqlDriver(mysqlMockDriver)
    .setMongoDriver(mongoMockDriver)
    .setAnalyzerFactory(analyzerMockFactory)
    .on('responseEnd', function(text) {

        //loggers.file.info(text.substr(0,1000));

    })
    .on('recodeEnd', function(text) {

        //loggers.file.info(text.substr(0,1000));

    });

requestManager
    .setConfig(config)
    .setLogger(loggerSimple)
    .setMysqlDriver(mysqlMockDriver)
    .setUserAgent(config.name + ' v.' + config.version)
    .setModel(function(response, guideBook) {

        var responseHandle = new responseFactory.create();
        responseHandle.run(response, guideBook);

    });

linksManager
    .setLogger(loggerSimple)
    .setConfig(config)
    .setMysqlDriver(mysqlMockDriver)
    .setBotPID('mock')
    .setOnIterateStart(function(guide) {
        //
    })
    .setRequestManager(function(guideBook) {

        requestManager.run(guideBook);
    })
    .setOnIterateFin(function(guide) {

        loggerSimple.info('%s : complete checking \n', scriptName);
        process.exit();

    });

// go
linksManager.run();