/**
 * Created by dezzpil on 20.01.14.
 *
 * Простейший способ определять логгеры для бота:
 * заходим по ссылке, смотрим список параметров и название
 * транспорта - прописываем их для соотв. логгера
 *
 */

var winston = require('winston');

winston.addColors({
    'info' : 'cyan',
    'error' : 'red',
    'warn' : 'yellow'
});

/**
 * @link https://github.com/flatiron/winston/blob/master/docs/transports.md
 *
 * Supports now : Console, File, MongoDB
 *
 * @param type {string}
 * @param options {object}
 * @returns winston.Logger
 */
function forge(type, options) {

    var logger = new winston.Logger();

    if (type) switch (type.toLowerCase()) {

        case "file" :
            logger.add(winston.transports.File, options);
            break;

        /**
         * @link https://github.com/indexzero/winston-mongodb
         */
        case "mongodb" :
            require('winston-mongodb').MongoDB;
            logger.add(winston.transports.MongoDB, options);
            break;

        case "empty" :
            logger = {
                'info' : function() {},
                'error' : function() {},
                'warn' : function() {},
                'log' : function() {}
            };
            break;

        case "console" :
            logger.add(winston.transports.Console, options);
            break;
    }

    logger.emitErrs = true;
    logger.exitOnError = false;

    return logger;

}

exports.forge = forge;