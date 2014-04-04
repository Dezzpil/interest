/**
 * Created by dezzpil on 4/4/14.
 */

var LoggersFactory  = require('./../driver/loggers');
var AnalyzeDriver   = require('./../driver/analyze/node');
var assert          = require('assert');
var async           = require('async');
var config          = require('./../configs/config.json');
var numCPUs  = require('os').cpus().length;

function formdata(num) {
    var bigdata = '', i;
    for (i = 0; i < (num / 2); i++) bigdata += 'a ';
    return bigdata;
}

(function(){

    var logger = LoggersFactory.forge(
        config.loggers.tests.type,
        config.loggers.tests.options
    );

    var options = {
        config : config,
        logger : logger
    };

    var analyzeDriver = new AnalyzeDriver(options);

    async.parallelLimit([
        function(callback){
            logger.info('ANALYZE DRIVER: simple compare');
            analyzeDriver.run('foo bar', 'foo bar', function(result, err) {
                assert.equal(result.change_percent, 0, 'simple compare');
                callback(null, true);
            });
        },
        function(callback){
            logger.info('ANALYZE DRIVER: badword id');

            analyzeDriver.run('хуй', 'хуй', function(result, err) {
                console.log('badword id', result.badword_id);
                assert.equal(parseInt(result.badword_id), 1, 'badword id');
                callback(null, true);
            });
        },
        function(callback) {
            logger.info('ANALYZE DRIVER: badword context');
            analyzeDriver.run('да хуй вам', 'да хуй вам', function(result, err) {
                console.log('badword context', result.badword_context);
                assert.equal(result.badword_context, 'да хуй вам', 'badword context');
                callback(null, true);
            });
        },
        function(callback) {
            logger.info('ANALYZE DRIVER: empty texts return dummy result');
            analyzeDriver.run(null, null, function(result, err) {
                assert.equal(result.change_percent, 0, 'empty texts return dummy result');
                callback(null, true);
            });
        },
        function(callback) {
            logger.info('ANALYZE DRIVER: sendind 2 string 10000 each');
            analyzeDriver.run(formdata(10000), formdata(10000), function(result, err) {
                assert.equal(result.change_percent, 0, 'sendind 2 string 10000 each');
                callback(null, true);
            });
        },
        function(callback) {
            logger.info('ANALYZE DRIVER: sendind 2 string 20000 each');
            analyzeDriver.run(formdata(20000), formdata(20000), function(result, err) {
                assert.equal(result.change_percent, 0, 'sendind 2 string 20000 each');
                callback(null, true);
            });
        },
        function(callback) {
            logger.info('ANALYZE DRIVER: sendind 2 string 30000 each');
            analyzeDriver.run(formdata(30000), formdata(30000), function(result, err) {
                assert.equal(result.change_percent, 0, 'sendind 2 string 30000 each');
                callback(null, true);
            });
        },
        function(callback) {
            logger.info('ANALYZE DRIVER: sendind 2 string 40000 each');
            analyzeDriver.run(formdata(40000), formdata(40000), function(result, err) {
                assert.equal(result.change_percent, 0, 'sendind 2 string 40000 each');
                callback(null, true);
            });
        },
        function(callback) {
            logger.info('ANALYZE DRIVER: sendind 2 string 50000 each');
            analyzeDriver.run(formdata(50000), formdata(50000), function(result, err) {
                assert.equal(result.change_percent, 0, 'sendind 2 string 50000 each');
                callback(null, true);
            });
        },
        function(callback) {
            logger.info('ANALYZE DRIVER: sendind 2 string 100000 each');
            analyzeDriver.run(formdata(100000), formdata(100000), function(result, err) {
                assert.equal(result.change_percent, 0, 'sendind 2 string 100000 each');
                callback(null, true);
            });
        }
    ], numCPUs,
    // optional callback
    function(err, results){
        if (err) {
            logger.info(err);
            process.exit(1);
        }

        process.exit();
    }
    );

})();