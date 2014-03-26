/**
 * Created by dezzpil on 22.11.13.
 */

var execFile = require('child_process').execFile,
    queryString = require('querystring');

function analyzeMockDriver(options) {

    var instances = [],
        count = 0, self = this,
        logger = options.loggerProcess,
        config = options.config.AnalyzerFactory;

    this.getInstances = function() {
        return instances;
    };

    this.empty = function() {

    };

    this.forge = function() {
        var a = new Analyzer();
        instances.push(a);
        return a;
    };

    function Analyzer() {

        var finFn = null,
            writeNum = 0,
            self = this,
            isTerminated = false;

        /**
         *
         * @param outputString
         * @returns {{percent: number, isBad: boolean}}
         */
        this.parseAnalyzeResult = function (outputString) {
            return self.getNoResult();
        }

        this.run = function(readyCallback, errorCallback, completeCallback) {

            if ( isTerminated) return false;

            finFn = function() {

                var analyzeResult = self.parseAnalyzeResult();
                readyCallback(analyzeResult);

                if (completeCallback) {
                    self.killAnalyzer(completeCallback);
                } else {
                    self.killAnalyzer();
                }

            }

            return false;
        };

        this.write = function(text) {

            /**
             * Real analyzer expects 2 texts for stdin
             */
            writeNum++;
            if (writeNum >= 2) finFn();

        };

        this.getNoResult = function() {
            return {
                'percent' : 0,
                'isBad' : false,
                'badWord' : ''
            }
        };

        /**
         *
         * @param callback
         */
        this.killAnalyzer = function(callback) {

            isTerminated = true;
            if (callback) callback();

        }

    }

}

exports.factory = function(options) {
    return new analyzeMockDriver(options);
}