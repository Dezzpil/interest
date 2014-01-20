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
        .setModel(function(response, guideBook) {

            /**
             * we get response here, may do what we want
             */

            var processor = new responseProcessor.create();
            processor.run(response, guideBook);

        });

    linkManager = (new link.manager())
        .setLoggers(botLoggers)
        .setOptions(config)
        .setMysqlDriver(mysql.driver)
        .setBotPID(botPID)
        .setOnIterateStart(function(guide) {

            /**
             * On link iteration start
             * @type {HeapDiff}
             */
            heapDiff = new memwatch.HeapDiff();

        })
        .setRequestManager(function(guideBook) {

            /**
             * we get link here, may do what we want
             */

            requestManager.run(guideBook);
        })
        .setOnIterateFin(function(guide) {

            /**
             * On link iteration end
             */
            mongo.driver.saveFerryTask(guide.getIdList(), botPID, function(err) {
                if (err) botLoggers.console.info('MongoDB error : ', err);
            });
            botLoggers.mongo.info(heapDiff.end());

        });

    return linkManager;
}

try {
    process.stdout.setEncoding('binary');
} catch (e) {
    // may be log into file
}

process.on('uncaughtException', function(err) {
    // silent is golden ?
    botLoggers.file.info('Caught exception: ' + err);
});

// prepare db drives
mysql.driver.setLoggers(botLoggers).setConfig(config.mysql).connect();
mongo.driver.setLoggers(botLoggers).setConfig(config.mongo).connect();

// go go go
main = init();
main.run();