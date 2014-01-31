/**
 * Created by dezzpil on 21.01.14.
 */

var exec = require('child_process').exec,
    path = require('path'),
    scriptName = path.basename(process.cwd(), '.js'),

    util = require('util'),
    options = {
        encoding: 'utf8',
        timeout: 0,
        maxBuffer: 200*1024,
        killSignal: 'SIGTERM',
        cwd: './tests',
        env: null
    },

    loggers = require('./../drivers/loggers'),
    loggerSimple = loggers.forge( "console", {colorize: true }),


    scriptForTestList = ['depending', 'responseModel'];


function startNextTest() {
    var testScriptName, child;

    testScriptName = scriptForTestList.shift();
    if ( ! testScriptName) {
        loggerSimple.info('%s : all test passed \n', scriptName);
        process.exit();
    }

    child = exec(
        'node ' + testScriptName + '.js',
        options,
        function(error, stdout, stderr) {

            if (error && stderr) {
                loggerSimple.error('%s : %s error\n', scriptName, testScriptName);
                process.exit(1);
            } else if (error) {
                loggerSimple.error('%s : error\n', scriptName, error.stack);
                process.exit(1);
            } else {
                loggerSimple.warn('%s : %s success \n', scriptName, testScriptName)
                startNextTest();
            }

        }
    );

    child.stdout.on('data', function(data) {
        util.print(data);
    });

    child.stderr.on('data', function(data) {
        util.print(data);
    });
}


var currentDir = path.basename(process.cwd());
if (currentDir == 'tests') {
    options.cwd = null;
}

loggerSimple.info('%s : start', scriptName);
startNextTest();