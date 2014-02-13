/**
 * @author Nikita Dezzpil Orlov
 * @date 18.11.2013
 */

//require('longjohn');


var memwatch = require('memwatch'),

    config = require('./configs/config.json'),
    mongo = require('./drivers/mongo'),
    mysql = require('./drivers/mysql'),
    link = require('./link'),
    request = require('./request'),
    response = require('./response'),
    analyzer = require('./drivers/analyzer'),
    async = require('async'),
    util = require('util'),

    botName = config.name + ' v.' + config.version,
    botPID = parseInt(process.pid),

    loggers = require('./drivers/loggers'),
    loggerProcess = loggers.forge(
        config.loggers.process.type,
        config.loggers.process.options
    ),
    loggerErrors = loggers.forge(
        config.loggers.errors.type,
        config.loggers.errors.options
    ),
    loggerMemory = loggers.forge(
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


try {
    process.stdout.setEncoding('binary');
} catch (e) {
    // whatever
}

process.on('uncaughtException', function(error) {

    if (util.isError(error)) {
        loggerErrors.error(error);
        loggerErrors.error(error.stack);

        // TODO collect errors somewhere (may be table in mongo ? )

    }

});

process.on('SIGTERM', function () {

    // Disconnect from cluster master
    process.disconnect && process.disconnect();
    process.exit();

});

//if (process.getgid() === 0) {
//    process.setgid('nobody');
//    process.setuid('nobody');
//}

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

            // save ferry tasks, only if guide guided something )
            var idList = guide.getIdList();
            if (idList.length) {
                mongo.driver.saveFerryTask(idList, botPID, function(err) {
                    if (err) throw err;
                });
            }

            loggerMemory.info(heapDiff.end());

        });

    return linkManager;
}

// prerequisites
async.parallel({
    'mysql' : function(callback) {
        loggerProcess.info('MYSQL - Connecting ...');
        mysql.driver
            .setLogger(loggerProcess)
            .setConfig(config.mysql)
            .connect(function(err) {
                callback(err, true);
            }
        );
    },
    'mongo' : function(callback) {
        loggerProcess.info('MONGODB - Connecting ...');
        mongo.driver
            .setLogger(loggerProcess)
            .setConfig(config.mongo)
            .connect(function(err) {
                callback(err, true);
            }
        );
    }
}, function(error, result) {

    // handle errors
    loggerProcess.info(result);
    if (error) throw error;

    // start process flow
    var linkManager = init().run();
});