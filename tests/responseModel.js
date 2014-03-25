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
    responseFactory = null,

    request = require('./../request'),
    requestManager = null,

    links = require('./../link'),
    linksManager = null,

    mongoMockDriver = require('./../drivers/mocks/mongo').driver,
    mysqlMockDriver = require('./../drivers/mocks/mysql').driver,
    analyzerMockFactory = require('./../drivers/mocks/analyzer').factory,

    loggers = require('./../drivers/loggers'),
    loggerSimple = loggers.forge( "console", { level : "info", colorize: true }),
    loggerErrors = loggers.forge( "console", { level : "info", colorize : true }),
    options = {
        'config' : config,
        'logger' : loggerSimple,
        'pid' : 'mock',
        'mysql' : mysqlMockDriver,
        'mongo' : mongoMockDriver,
        'useragent' : 'te#w2@'
    };



process.on('uncaughtException', function(error) {
    if (util.isError(error)) {
        loggerErrors.error(error.toString());
        loggerErrors.error(error.stack);
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

responseFactory = new response.factory(analyzerMockFactory, options);
responseFactory
    .on('response', function(data) { return data; })
    .on('recode', function(data) { return data; });

requestManager = new request.manager(options, function(response, guideBook) {
    var responseHandle = new responseFactory.create();
    responseHandle.run(response, guideBook);
});

(new links.manager(options, function(guideBook) {

    requestManager.run(guideBook);

})).on('end', function(guide) {

    loggerSimple.info('%s : complete checking \n', scriptName);
    process.exit();

}).run();