/**
 * Created by dezzpil on 26.12.13.
 */



var config = require('./../configs/config.json'),
    loggers = require('./../drivers/loggers'),
    mongo = require('./../drivers/mongo').driver,
    mongoNative = require('./../drivers/mongo-native').driver,
    mysql = require('./../drivers/mysql').driver,
    botLoggers = loggers.forge(0);

function main() {

    mysql.setLoggers(botLoggers).setConfig(config.mysql).connect();
    mongo.setLoggers(botLoggers).setConfig(config.mongo).connect();
    mongoNative.setLoggers(botLoggers).setConfig(config.mongo).connect(function(err) {
        if (err) {
            console.error(err);
            process.exit(4);
        }
    });

    var success = { 'mysql' : false, 'mongo' : false, 'mongoNative' : false },
        wait = setInterval(function() {
            var successCount = 0, successExpectCount = 0, db;

            for (db in success) {
                successExpectCount++;
                if (success[db]) successCount++;
            }

            if (successCount == successExpectCount) {
                clearInterval(wait);
                console.info('end - success. all data was successfully reset');
                process.exit(15);
            }
        }, 1000);


    // reset all data collected by bot
    mysql.resetLinks(function(err, rows) {
        if (err) {
            console.error('mysql - error : ', err);
            process.exit(4);
        }
        console.info('mysq - all rows has been reset');
        success.mysql = true;
    });

    mongo.removeAllDocs(function(err) {
        if (err) {
            console.error('mongo - error : ', err);
            process.exit(4);
        }
        console.info('mongo - all documents has been removed');
        success.mongo = true;

        mongoNative.ensureTTL(function(err) {
            if (err) console.error(err);
            else {
                success.mongoNative = true;
                console.info('TTL for log collection created');
            }
        });
    });



}

process.on('SIGILL', function() {
    console.info('end - error occured');
    process.exit(1);
});

main();