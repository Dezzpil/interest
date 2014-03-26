/**
 * Created by dezzpil on 22.11.13.
 */

var execFile     = require('child_process').execFile;
var queryString  = require('querystring');
var EventEmitter = require('events').EventEmitter;
var util         = require('util');

function analyzeExecDriver(options) {

    var self = this,
        logger = options.loggerProcess,
        config = options.config.AnalyzerFactory,
        process,
        isTerminated = false;

    EventEmitter.call(this);

    /**
     *
     * @param outputString
     * @returns {{percent: number, isBad: boolean, badWord: string}}
     */
    function parseResult(outputString) {

        var vals = outputString.split('|'),
            percent = 1000, badWord = '',
            result;

        if (vals[0].length <= 3) percent = parseInt(vals[0]);
        if (vals[2]) badWord = vals[2].trim();

        result = {
            'percent' : parseInt(((1000 - percent) / 1000) * 100),
            'isBad' : vals[1],
            'badWord' : badWord
        };

        return result;
    }

    /**
     *
     * @param callback
     */
    function kill(callback) {

        isTerminated = true;
        var err = null;

        try {
            if (process) { // если процесс уже создан
                process.stdin.end();
                process.kill(config.killSignal);
                delete(process);
            }
        } catch (e) {
            err = e;
        }

        if (callback) callback(err);

    }

}

util.inherits(analyzeExecDriver, EventEmitter);
analyzeExecDriver.prototype.run = function() {

    if ( isTerminated) return false;
    process = execFile(
        config.path + config.fileName,
        function (error, stdout, stderr) {
            if (error || stderr) {

                kill();
                self.emit('error', { 'error' : error, 'stderr' : stderr });

            } else {

                kill();
                self.emit('success', parseResult(stdout));

            }
        }
    );

    process.stdin.setEncoding('binary');
    return true;
};

analyzeExecDriver.prototype.write = function(text) {
    process.stdin.write(
        queryString.escape(text) + '\n',
        'utf8'
    );
};

module.export = analyzeExecDriver;