/**
 * Created by dezzpil on 18.11.13.
 *
 */

var memwatch = require('memwatch'),

    config = require('./configs/config.json'),
    loggers = require('./drivers/loggers'),
    mongo = require('./drivers/mongo'),
    mysql = require('./drivers/mysql'),
    link = require('./link'),
    request = require('./request'),
    response = require('./response'),
    analyzer = require('./drivers/analyzer'),

    botName = config.name + ' v.' + config.version,
    now = new Date(),
    botPID = parseInt(now.getTime()/1000),

    botLoggers = loggers.forge(botPID);

function init() {

    var linkManager, requestManager,
        heapDiff, responseProcessor, analyzeFactory;

    mysql.driver.setLoggers(botLoggers).setConfig(config.mysql).connect();
    mongo.driver.setLoggers(botLoggers).setConfig(config.mongo).connect();

    analyzeFactory = (new analyzer.factory())
        .setOptions(config.analyzer)
        .setLoggers(botLoggers);

    responseProcessor = (new response.factory())
        .setLoggers(botLoggers)
        .setMysqlDriver(mysql.driver)
        .setBotPID(botPID)
        .setMongoDriver(mongo.driver)
        .setOptions(config)
        .setAnalyzerFactory(analyzeFactory);

    requestManager = (new request.manager())
        .setMysqlDriver(mysql.driver)
        .setLoggers(botLoggers)
        .setUserAgent(botName)
        .setOptions(config)
        .setModel(responseProcessor.create);

    linkManager = (new link.manager())
        .setLoggers(botLoggers)
        .setOptions(config)
        .setMysqlDriver(mysql.driver)
        .setBotPID(botPID)
        .setOnIterateStart(function() {
            heapDiff = new memwatch.HeapDiff();
        })
        .setRequestManager(function(guideBook) {
            // for each link we run requestManager's method
            requestManager.run(guideBook);
        })
        .setOnIterateFin(function(guide) {
            mongo.driver.saveFerryTask(guide.getIdList(), botPID, function(err) {
                if (err) botLoggers.console.info('MongoDB error : ', err);
            });
            botLoggers.mongo.info(heapDiff.end());
        });

    return linkManager;
}

// TODO check charsetProcessing.command is recode || iconv and
// TODO selected option is availiable

// TODO check if analyzer dir is availiable and analyzer exists

try {
    process.stdout.setEncoding('binary');
} catch (e) {
    // may be log into file
}

main = init();
main.run();

process.on('uncaughtException', function(err) {

    // если что-то отвалилось внезапно
    // бот тихо продолжает работать дальше
    botLoggers.file.info('Caught exception: ' + err);

});