/**
 * Created by dezzpil on 30.12.13.
 */

var exec = require('child_process').exec,
    execFile = require('child_process').execFile,
    async = require('async'),
    config = require('./../configs/config.json'),
    mongoNative = require('./../drivers/mongo-native').driver,
    mysqlDriver = require('./../drivers/mysql').driver,
    stdoutLoggers = require('./../drivers/mocks/loggers').forge(),
    successNum = 0,
    scriptName = 'dependings';

console.log('%s : start checking', scriptName);

function error(key, err) {
    console.error('%s : %s ', scriptName, key + ' error', err);
    process.exit(1);
}

function success(key, callback) {
    successNum++;
    console.log('%s : %s', scriptName, key + ' ok');
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
        console.log('%s : analyzer path: %s', scriptName, config.path + config.analyzer.path + config.analyzer.fileName);
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

    'mysql' : function(callback) {
        var key = 'mysql';
        mysqlDriver
            .setLoggers(stdoutLoggers)
            .setConfig(config.mysql)
            .connect(function(err){
                if (err) error(key, err);
                success(key, callback);
            }
        );
    },

    'mongo connection' : function(callback) { // if mongodb collections exists
        var key = 'mongo connection';
        mongoNative
            .setConfig(config.mongo)
            .connect(function(err, db) {
                if (err) error(key, err);
                success(key, callback);
            }
        );
    },

    'mongo сollections' : function(callback) {
        mongoNative.onConnection(function() {
            mongoNative.checkCollections(function(info) {
                console.log(info);
                successNum++;
                callback(null, 'mongo collections');
            });
        });
    },

    'mongo ttl index' : function(callback) {
        var key = 'mongo ttl index';
        mongoNative.onConnection(function() {
            mongoNative.ensureTTL(function(err) {
                if (err) error(key, err);
                success(key, callback);
            })
        });
    }
}, function(err, results) {
        console.log('%s : all checks was complete', scriptName);
        console.log('%s : success %d from 7', scriptName, successNum);
        process.exit();
    }
);
