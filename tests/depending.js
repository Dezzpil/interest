/**
 * npm test
 * Created by dezzpil on 30.12.13.
 */
var exec           = require('child_process').exec;
var async          = require('async');
var path           = require('path');
var scriptName     = path.basename(process.cwd(), '.js');
var LoggerFactory  = require('./../driver/loggers');

(function(){

    var config = require('./../configs/config.json'),
        logger = LoggerFactory.forge(
            config.loggers.tests.type,
            config.loggers.tests.options
        );

    logger.info('%s : start checking', scriptName);

    function error(key, err, callback) {
        logger.error('%s : %s ', scriptName, key + ' error', err, err.stack);
        callback(err, key);
    }

    function success(key, callback, extraText) {
        logger.info('%s : %s', scriptName, key + ' ok ' + (extraText ? '( ' + extraText + ')' : ''));
        callback(null, key);
    }

    async.parallel({

        'chardet' : function(callback) { // if chardet exists
            var key = 'chardet',
                chardet = exec(
                config.path + config.encode.detectionName + ' ' + scriptName,
                function(err, stdout) {
                    if (err) error(key, err, callback);
                    success(key, callback);
                }
            );
        },

        'recode' : function(callback) { // if recode exists
            var key = config.encode.recodeName,
                recode = exec(
                    key + ' ascii..latin1',
                    function(err, stdout) {
                        if (err) error(key, err);
                        success(key, callback);
                    }
                );

            recode.stdin.on('error', function(err) {
                if (err) error(key, err);
            });

            recode.stdin.end('foo bar');
        }

    }, function(err, results) {
            if (err) process.exit(1);

            logger.info('%s : all checks was complete', scriptName);
            process.exit();
        }
    );

})();