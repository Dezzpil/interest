/**
 * Created by dezzpil on 21.01.14.
 */
var exec          = require('child_process').exec;
var path          = require('path');
var util          = require('util');
var name          = path.basename(process.cwd(), '.js');
var config        = require('./../configs/config.json');
var LoggerFactory = require('./../driver/loggers');

(function(){

    var logger = LoggerFactory.forge(
            config.loggers.tests.type,
            config.loggers.tests.options
        ),
        scriptForTestList = [
            'depending', 'linksManager', 'requestManager',
            'responseManager', 'linksCollector', 'textsCollector'
        ],
        options = {
            encoding: 'utf8',
            timeout: 0,
            maxBuffer: 200*1024,
            killSignal: 'SIGTERM',
            cwd: './tests',
            env: null
        };

    function startNextTest() {
        var child, testScriptName = scriptForTestList.shift();

        if ( ! testScriptName) {
            logger.info('%s : all test passed \n', name);
            process.exit();
        }

        child = exec(
            'node ' + testScriptName + '.js',
            options,
            function(error, stdout, stderr) {

                if (error && stderr) {
                    logger.error('%s : %s error\n', name, testScriptName);
                    process.exit(1);
                } else if (error) {
                    logger.error('%s : error\n', name, error.stack);
                    process.exit(1);
                } else {
                    logger.verbose('%s : %s success \n', name, testScriptName)
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

    logger.info('%s : start', name);
    startNextTest();

})();