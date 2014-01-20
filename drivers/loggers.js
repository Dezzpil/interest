/**
 * Created by dezzpil on 20.01.14.
 *
 * Простейший способ определять логгеры для бота:
 * заходим по ссылке, смотрим список параметров и название
 * транспорта - прописываем их для соотв. логгера
 *
 */

var winston = require('winston');

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

    winston.addColors({
        'info' : 'cyan'
    });

    var logger = new winston.Logger({
        transports: [
            new (winston.transports.Console)()
        ]
    });

    if (type) switch (type.toLowerCase()) {

        case "file" :
            logger.add(winston.transports.File, options);
            logger.remove(winston.transports.Console);
            break;

        /**
         * @link https://github.com/indexzero/winston-mongodb
         */
        case "mongodb" :
            require('winston-mongodb').MongoDB;
            logger.add(winston.transports.MongoDB, options);
            logger.remove(winston.transports.Console);
            break;

        case "console" :
            logger.remove(winston.transports.Console);
            logger.add(winston.transports.Console, options);
            break;
    }

    return logger;

}

exports.forge = forge;