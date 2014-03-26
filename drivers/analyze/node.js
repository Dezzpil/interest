/**
 * Created by dezzpil on 24.03.14.
 */

var execFile     = require('child_process').execFile;
var queryString  = require('querystring');
var EventEmitter = require('events').EventEmitter;
var util         = require('util');

function analyzeNodeDriver(options) {

    EventEmitter.call(this);

    this.logger = options.loggerProcess;
    this.config = options.config.analyze;
    this.data = [];

    /**
     * @returns {{percent: number, isBad: boolean, badWord: string}}
     */
    this.on('data', function() {
        /**
         * @todo write logic for compare data
         * @type {{percent: *, isBad: boolean, badWord: *}}
         */



        if (this.data.length == 1) { // find bad words



        }

        if (this.data.length > 1) { // compare 2 texts

        }


        var result = {
            'percent' : 0,
            'isBad' : false,
            'badWord' : '][akep'
        };

        this.emit('success', result);

    })

}


util.inherits(analyzeNodeDriver, EventEmitter);

analyzeNodeDriver.prototype.write = function(text) {
    this.data.push(text);
};

analyzeNodeDriver.prototype.end = function(text) {
    this.data.push(text);
    this.emit('data');
};

module.exports = analyzeNodeDriver;