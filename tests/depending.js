/**
 * npm test
 * Created by dezzpil on 30.12.13.
 */

var exec = require('child_process').exec,
    execFile = require('child_process').execFile,
    async = require('async'),
    path = require('path'),
    scriptName = path.basename(process.cwd(), '.js'),

    config = require('./../configs/config.json'),
    mongoNative = require('./../drivers/mongo-native').driver,
    mysqlDriver = require('./../drivers/mysql').driver,
    
    loggers = require('./../drivers/loggers'),
    loggerSimple = loggers.forge( "console", { level : "info", colorize: true }),
    loggerEmpty = loggers.forge("empty", {}),
    loggerErrors = loggers.forge( "console", { level : "error", colorize : true }),
    
    successNum = 0;


mongoNative.setConfig(config.mongo).setLogger(loggerEmpty);
mysqlDriver.setConfig(config.mysql).setLogger(loggerEmpty);

loggerSimple.info('%s : start checking', scriptName);

function error(key, err) {
    loggerErrors.error('%s : %s ', scriptName, key + ' error', err, err.stack);
    process.exit(1);
}

function success(key, callback, extraText) {
    successNum++;
    loggerSimple.info('%s : %s', scriptName, key + ' ok ' + (extraText ? '( ' + extraText + ')' : ''));
    callback(null, key);
}

async.parallel({

    'chardet' : function(callback) { // if chardet exists
        var key = 'chardet',
            chardet = exec(
            config.path + config.charsetProcessing.detectionName + ' ' + scriptName,
            function(err, stdout) {
                if (err) error(key, err);
                success(key, callback);
            }
        );
    },

    'recode' : function(callback) { // if recode exists
        var key = config.charsetProcessing.recodeName,
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
    },

    'analyzer' : function(callback) { // if analyzer exists
        loggerSimple.info('%s : analyzer path: %s', scriptName, config.path + config.analyzer.path + config.analyzer.fileName);
        var key = 'analyzer',
            analyzer = execFile(config.path + config.analyzer.path + config.analyzer.fileName, function(err, stdout) {
                if (err) error(key, err);
                success(key, callback);
            }
        );

        analyzer.stdin.on('error', function(err) {
            if (err) error(key, err);
        });

        analyzer.stdin.write('foobar');
        analyzer.stdin.end('foobar1');
    },

    'mysql connection' : function(callback) {
        var key = 'mysql connection';
        mysqlDriver
            .connect(function(err){
                if (err) error(key, err);
                success(key, callback);
            }
        );
    },

    'mysql operations' : function(callback) {
        var key = 'mysql operations';
        mysqlDriver.getLinks(1, function(err, rows) {
            if (err) error(key, err);
            success(key, callback);
        });
    },

    'mongo connection' : function(callback) { // if mongodb collections exists
        var key = 'mongo connection';
        mongoNative
            .connect(function(err) {
                if (err) error(key, err);
                success(key, callback);
            }
        );
    },

    'mongo сollections' : function(callback) {
        var key = 'mongo collections';
        mongoNative.onConnection(function() {
            mongoNative.checkCollections(function(info) {
                // if (err) error(key, err);
                success(key, callback, info);
            });
        });
    },

    'mongo ttl index' : function(callback) {
        var key = 'mongo ttl index';
        mongoNative.onConnection(function() {
            mongoNative.ensureLogTTL(function(err) {
                if (err) error(key, err);
                success(key, callback);
            })
        });
    }
}, function(err, results) {
        loggerSimple.info('%s : all checks was complete', scriptName);
        loggerSimple.info('%s : success %d from 8', scriptName, successNum);
        loggerSimple.info('%s : complete checking \n', scriptName);
        process.exit();
    }
);
