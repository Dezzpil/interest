/**
 * Created by dezzpil on 30.12.13.
 */

var exec = require('child_process').exec,
    execFile = require('child_process').execFile,
    async = require('async'),
    config = require('./../configs/config.json'),
    mongoNative = require('./../drivers/mongo-native').driver,
    successNum = 0,
    scriptName = 'dependings';

console.log('%s : start checking', scriptName);

async.parallel({
    'chardet' : function(callback) { // if chardet exists
        exec(
            config.path + config.charsetProcessing.detectionName + ' ' + scriptName,
            function(err, stdout) {
                if (err) console.error('%s : chardet error ', scriptName, err.message);
                else { console.log('%s : chardet exists', scriptName); successNum++; }
                callback(null, 'chardet');
            }
        );
    },
    'recode' : function(callback) { // if recode exists
        var recode = exec(
            config.charsetProcessing.recodeName + ' ascii..latin1',
            function(err, stdout) {
                if (err) console.error('%s : recode error ', scriptName, err);
                else { console.log('%s : recode exists', scriptName); successNum++;}
                callback(null, 'recode');
            }
        );
        recode.stdin.end('foobar');
    },
    'analyzer' : function(callback) { // if analyzer exists
        console.log('%s : analyzer path: %s', scriptName, config.path + config.analyzer.path + config.analyzer.fileName);

        analyzer = execFile(config.path + config.analyzer.path + config.analyzer.fileName, function(err, stdout) {
            if (err) console.error('%s : analyzer error ', scriptName, err);
            else { console.log('%s : analyzer exists', scriptName); successNum++; }
            callback(null, 'analyzer');
        });
        analyzer.stdin.write('foobar');
        analyzer.stdin.end('foobar1');
    },
    'mongo' : function(callback) { // if mongodb collections exists
        mongoNative.setConfig(config.mongo).connect(
            function(err, db) {

                if (err) console.log('%s : mongo connect err', scriptName, err);
                else {
                    console.log('%s : mongo connect successful', scriptName);
                    successNum++;
                }

                callback(null, 'mongo');
            }
        );
    },
    'mongoсollections' : function(callback) {
        mongoNative.onConnection(function() {
            mongoNative.checkCollections(function(info) {
                console.log(info);
                successNum++;
                callback(null, 'mongoCollections');
            });
        });
    },
    'mongottl' : function(callback) {
        mongoNative.onConnection(function() {
            mongoNative.ensureTTL(function(err) {
                if (err) console.error('%s mongo ttl error %s', scriptName, err);
                else { console.log('%s mongo ttl ok', scriptName); successNum++; }
                callback(null, 'mongottl');
            })
        });
    }
}, function(err, results) {
        console.log('%s : all checks was complete', scriptName);
        console.log('%s : success %d from 6', scriptName, successNum);
        process.exit();
    }
);
