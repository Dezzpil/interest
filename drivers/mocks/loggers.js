/**
 * Created by dezzpil on 13.01.14.
 * All write in stdout
 */
var winston = require('winston');

function forge() {

    var writterToStdout = new (winston.Logger)({
        transports : [new (winston.transports.Console)({
            timestamp : true,
            colorize : true,
            silent : false,
            level : 'debug'
        })]
    }), loggersBuild = {
        'file' : writterToStdout,
        'console' : writterToStdout,
        'mongo' : writterToStdout
    };

    return loggersBuild;
}

exports.forge = forge;