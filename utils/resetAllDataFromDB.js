/**
 * Created by dezzpil on 26.12.13.
 */

var async = require('async'),

    config = require('./../configs/config.json'),

    mongo = require('./../drivers/mongo').driver,
    mongoNative = require('./../drivers/mongo-native').driver,
    mysql = require('./../drivers/mysql').driver,

    loggers = require('./../drivers/loggers'),
    logger = loggers.forge(
        config.loggers.process.type,
        config.loggers.process.options
    );

process.on('SIGILL', function() {
    logger.info('end - error occured');
    process.exit();
});

/**
 * it's bad, i know
 */
function main() {

    var success, wait;

    success = {
        'mysql' : false,
        'mongo' : false,
        'mongoLogTTL' : false
    };

    wait = setInterval(function() {
        var successCount = 0, successExpectCount = 0, db;

        for (db in success) {
            successExpectCount++;
            if (success[db]) successCount++;
        }

        if (successCount == successExpectCount) {
            clearInterval(wait);
            logger.info('Reseting data - fin success');
            process.exit();
        }
    }, 1000);

    mysql.resetLinks(function(err, rows) {
        if (err) {
            logger.error('mysql - error : ', err);
            process.exit(4);
        }
        logger.info('mysq - all rows has been reset');
        success.mysql = true;
    });

    mongo.removeAllDocs(function(err) {
        if (err) {
            logger.error('mongo - error : ', err);
            process.exit(4);
        }
        logger.info('mongo - all documents has been removed');
        success.mongo = true;

        mongoNative.onConnection(function() {

            mongoNative.ensureLogTTL(function(err) {
                if (err) logger.error(err);
                else {
                    success.mongoLogTTL = true;
                    logger.info('TTL for log collection created');
                }
            });

        });
    });
}


mysql.setLogger(logger).setConfig(config.mysql);
mongo.setLogger(logger).setConfig(config.mongo);
mongoNative.setLogger(logger).setConfig(config.mongo);

logger.info('Reseting data - start');

async.parallel({
    'mysql' : function(callback) {
        logger.info('MYSQL - Connecting ...');
        mysql.connect(function(err) {
                callback(err, true);
            }
        );
    },
    'mongo' : function(callback) {
        logger.info('MONGODB throw mongoose - Connecting ...');
        mongo.connect(function(err) {
                callback(err, true);
            }
        );
    },
    'mongo_native' : function(callback) {
        logger.info('MONGODB throw mongodb - Connecting ...');
        mongoNative.connect(function(err) {
                callback(err, true);
            }
        );
    }

}, function(error, result) {

    logger.info(result);

    if (error) throw error;

    main();
});