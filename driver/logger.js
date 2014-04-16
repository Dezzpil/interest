/**
 * Created by dezzpil on 4/17/14.
 */


winston = require('winston');

winston.addColors({
    'info' : 'cyan',
    'error' : 'red',
    'warn' : 'yellow'
});

function tests(config) {

}

function _map(type, logger, options) {

    if (type) switch (type.toLowerCase()) {

        case "file" :
            logger.add(winston.transports.File, options);
            break;

        case "mongodb" :
            require('winston-mongodb').MongoDB;
            logger.add(winston.transports.MongoDB, options);
            break;

        case "console" :
            logger.add(winston.transports.Console, options);
            break;
    }
}

exports.work = function(config) {

    var logger = new (winston.Logger)();

    _map(config.loggers.process.type, logger, config.loggers.process.options);
    _map(config.loggers.errors.type, logger, config.loggers.errors.options);
    _map(config.loggers.memory.type, logger, config.loggers.memory.options);

    return logger;
};
