/**
 * Created by dezzpil on 28.11.13.
 */
var config = require('./configs/config.json'),
    winston = require('winston'),
    mongoLog = require('winston-mongodb').MongoDB;

function forge(botPID) {

    var glue = '-',
        loggerFile = null,
        loggerConsole = null,
        loggerMongo = null,
        now = new Date(),
        nowDate = now.getFullYear() + glue + (now.getMonth() + 1) + glue + now.getDate();

    loggerFile = new (winston.Logger)({
        transports: [new (winston.transports.File)({
            filename : config.logs.path +  botPID + glue + nowDate + config.logs.fileExt,
            silent : false,
            level : 'debug',
            colorize : false,
            timestamp : true,
            maxFiles : 5,
            json : false
        })],
        exitOnError: true
    });

    loggerMongo = new (winston.Logger)({
        transports: [new (mongoLog)({
            host : config.mongo.host,
            port : config.mongo.port,
            username : config.mongo.username,
            password : config.mongo.password,
            db : config.mongo.db,
            level : 'debug',
            collection : config.logs.tableName
            // safe : true,
            // silent : false,
        })],
        exitOnError: false
    });

    loggerConsole = new (winston.Logger)({
        transports : [new (winston.transports.Console)({
            timestamp : true,
            colorize : true,
            silent : false,
            level : 'debug'
        })]
    });


    loggerFile.on('error', function(err) {
        loggerConsole.error(err);
    });

    loggerMongo.on('error', function(err) {
        loggerConsole.error(err);
        loggerFile.error(err);
    });

    return {
        //'file' : loggerFile,
        //'console' : loggerConsole,
        'file' : loggerConsole,
        'console' : loggerFile,
        'mongo' : loggerMongo
    }

}

exports.forge = forge;