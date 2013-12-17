/**
 * Created by dezzpil on 18.11.13.
 *
 */

var now = new Date(),
    memwatch = require('memwatch'),
    fs = require('fs'),
    configJSON = fs.readFileSync('./configs/config.json'),
    config = JSON.parse(configJSON),
    loggers = require('./drivers/loggers'),
    mongo = require('./drivers/mongo'),
    mysql = require('./drivers/mysql'),
    links = require('./links'),
    requests = require('./requests'),
    model = require('./model'),
    analyzer = require('./drivers/analyzer'),

    botName = config.name + ' v.' + config.version,
    botPID = parseInt(now.getTime()/1000),

    botLoggers = loggers.forge(botPID);//,
    //main = null;

function init() {

    var linkManager, requestManager,
        heapDiff, analyzeProcess, analyzeFactory;

    mysql.driver.setLoggers(botLoggers).connect();
    mongo.driver.setLoggers(botLoggers).connect();

    analyzeFactory = (new analyzer.factory())
        .setOptions(config.analyzer)
        .setLoggers(botLoggers);

    analyzeProcess = (new model.init())
        .setLoggers(botLoggers)
        .setMysqlDriver(mysql.driver)
        .setBotPID(botPID)
        .setMongoDriver(mongo.driver)
        .setOptions(config)
        .setAnalyzerFactory(analyzeFactory);

    requestManager = (new requests.manager())
        .setMysqlDriver(mysql.driver)
        .setLoggers(botLoggers)
        .setUserAgent(botName)
        .setOptions(config)
        .setModel(analyzeProcess.run);

    linkManager = (new links.manager())
        .setLoggers(botLoggers)
        .setOptions(config)
        .setMysqlDriver(mysql.driver)
        .setBotPID(botPID)
        .setOnIterateStart(function() {
            heapDiff = new memwatch.HeapDiff();
        })
        .setRequestManager(function(guideBook) {
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

main = init();
main.run();

process.on('uncaughtException', function(err) {

    // если что-то отвалилось внезапно
    // бот тихо продолжает работать дальше
    botLoggers.file.info('Caught exception: ' + err);
    console.log(err);

});