/**
 * Created by dezzpil on 24.03.14.
 */

var execFile     = require('child_process').execFile;
var queryString  = require('querystring');
var EventEmitter = require('events').EventEmitter;
var util         = require('util');
var net          = require('net');
var buffer       = require('buffer');

function analyzeNodeDriver(options) {

    EventEmitter.call(this);

    this.logger = options.logger;
    this.config = options.config.analyzer;
    this.data = [];

}


util.inherits(analyzeNodeDriver, EventEmitter);

analyzeNodeDriver.prototype.write = function(text) {

    this.data.push(text);
    if (this.data.length < 2) return;

    // opens socket only after 2 strings have been given
    var self = this, socket;
    socket = net.createConnection(this.config.port, this.config.host, function() {

        var buffer, i;

        for (i in self.data) {
            buffer = new Buffer(self.data[i], 'utf8');
            socket.write(buffer, 'utf8');
        }

    });

    socket.setEncoding('utf8');

    socket.on('data', function(result) {
        self.emit('success', result);
        socket.end();
    });

    socket.on('error', function(err) {
        self.emit('error', err);
        socket.end();
    });
};

module.exports = analyzeNodeDriver;