/**
 * Created by dezzpil on 30.12.13.
 */

var exec = require('child_process').exec,
    execFile = require('child_process').execFile,
    async = require('async'),
    config = require('./../configs/config.json'),
    mongoNative = require('./../drivers/mongo-native').driver,
    successNum = 0,
    errorNum = 0;

console.log('filename: %s', process.argv[1]);
console.log('analyzer path: %s\n', config.path + config.analyzer.path + config.analyzer.fileName);

console.log('start checking\n');

async.parallel({
    'chardet' : function(callback) {
        // if chardet exists
        exec('chardet ' + process.argv[1], function(err, stdout) {
            if (err) console.error('ERROR: ', err.message);
            else { console.log('chardet: exists'); successNum++; }
            callback(null, 'chardet');
        });

    },
    'recode' : function(callback) {
        // if recode exists
        var recode = exec('recode ascii..latin1', function(err, stdout) {
            if (err) console.error('ERROR: ', err);
            else { console.log('recode: exists'); successNum++;}
            callback(null, 'recode');
        });
        recode.stdin.end('foobar');
    },
    'analyzer' : function(callback) {
        // if analyzer exists
        analyzer = execFile(config.path + config.analyzer.path + config.analyzer.fileName, function(err, stdout) {
            if (err) console.error('error: ', err);
            else { console.log('analyzer: exists'); successNum++; }
            callback(null, 'analyzer');
        });
        analyzer.stdin.write('foobar');
        analyzer.stdin.end('foobar1');
    },
    'mongo' : function(callback) {
        // if mongodb collections exists
        mongoNative.setConfig(config.mongo).connect();
        // if mongodb collections exists

        mongoNative.checkCollections(function(info) {
            console.log(info);
            successNum++;
            callback(null, 'mongo');
        });


    }
}, function(err, results) {

        console.log('all checks was complete');
        console.log('success %d from 4', successNum);
        process.exit();
    }
);