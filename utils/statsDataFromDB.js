/**
 * Created by dezzpil on 26.12.13.
 *
 * @todo write some notes
 *
 */



var config = require('./../configs/config.json'),
    loggers = require('./../drivers/loggers'),
    mongoNative = require('./../drivers/mongo-native'),
    mysql = require('./../drivers/mysql'),
    botLoggers = loggers.forge(0);

function main() {

    mysql.driver.setLoggers(botLoggers).setConfig(config.mysql).connect();
    mongoNative.driver.setLoggers(botLoggers).setConfig(config.mongo).connect();

    // todo refactor to async.parallel()

    var success = { 'mysql' : false, 'mongo' : false },
        wait = setInterval(function() {
            var successCount = 0, successExpectCount = 0, db;

            for (db in success) {
                successExpectCount++;
                if (success[db]) successCount++;
            }

            if (successCount == successExpectCount) {
                clearInterval(wait);
                console.info('end - success');
                process.exit(15);
            }
        }, 1000);


    mysql.driver.getStats('2013-12-27 00:00:00', function(results) {

        success.mysql = true;
        var propPadded, prop, subprop;

        for (prop in results) {

            propPadded = prop;
            while (propPadded.length < 10) {
                propPadded += ' ';
            }

            if (results[prop].length > 1) {
                console.log('%s\n', prop);
                for (subprop in results[prop]) {
                    console.log('\t', results[prop][subprop]);
                }
            } else {
                for (subprop in results[prop]) {
                    console.info('%s\t', propPadded, results[prop][subprop]);
                }
            }

        }

    });

    mongoNative.driver.stats(null, function(err, stats) {
        success.mongo = true;
        console.log(stats);
    });

}

process.on('SIGILL', function() {
    console.info('end - error occured');
    process.exit(1);
});

main();