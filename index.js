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
    async = require('async'),

    botName = config.name + ' v.' + config.version,
    now = new Date(),
    botPID = parseInt(now.getTime()/1000),

    loggerProcess = loggers.forge(
        config.loggers.process.type,
        config.loggers.process.options
    ),

    loggerErrors = loggers.forge(
        config.loggers.errors.type,
        config.loggers.errors.options
    ),

    loggerMemory = loggers.forge(
        "mongodb",
        {
            "db" : config.mongo.db,
            "host" : config.mongo.host,
            "port" : config.mongo.port,
            "username" : config.mongo.username,
            "password" : config.mongo.password,
            "timeout" : config.mongo.reconnectTimeout,
            "collection" : "logs",
            "level" : "info",
            "silent" : false,
            "safe" : false
        }
    );


function init() {

    var linkManager, requestManager,
        heapDiff, responseProcessor, analyzeFactory;

    analyzeFactory = (new analyzer.factory())
        .setConfig(config.analyzer)
        .setLogger(loggerProcess);

    responseProcessor = (new response.factory())
        .setLogger(loggerProcess)
        .setMysqlDriver(mysql.driver)
        .setBotPID(botPID)
        .setMongoDriver(mongo.driver)
        .setConfig(config)
        .setAnalyzerFactory(analyzeFactory);

    requestManager = (new request.manager())
        .setMysqlDriver(mysql.driver)
        .setLogger(loggerProcess)
        .setUserAgent(botName)
        .setConfig(config)
        .setModel(function(response, guideBook) {

            /**
             * we get response here, may do what we want
             */

            var processor = new responseProcessor.create();
            processor.run(response, guideBook);

        });

    linkManager = (new link.manager())
        .setLogger(loggerProcess)
        .setConfig(config)
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
                if (err) throw err;
            });

            loggerMemory.info(heapDiff.end());

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
    loggerErrors.info(err);
});

// prerequisites
async.parallel({
    'mysql' : function(callback) {
        mysql.driver
            .setLogger(loggerProcess)
            .setConfig(config.mysql)
            .connect(function(err) {
                loggerProcess.info('MYSQL - Connecting ...');
                callback(err, true);
            }
        );
    },
    'mongo' : function(callback) {
        mongo.driver
            .setLogger(loggerProcess)
            .setConfig(config.mongo)
            .connect(function(err) {
                loggerProcess.info('MONGODB - Connecting ...');
                callback(err, true);
            }
        );
    }
}, function(error, result) {

    loggerProcess.info(result);

    if (error) throw error;

    init().run();
});