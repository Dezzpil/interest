/**
 * Created by dezzpil on 28.11.13.
 */
var config = require('./../configs/config.json'),
    winston = require('winston'),
    mongoLog = require('winston-mongodb').MongoDB;

function forge(botPID) {

    function stub() {
        this.info = function() {};
        this.log = function() {};
        this.error = function() {};
        this.profile = function() {};
    }

    var glue = '-',
//        writterToFile = null,
        writterToStdout = null,
        writterToMongo = null,
        now = new Date(),
        loggersBuild = {},
        nowDate = now.getFullYear() + glue + (now.getMonth() + 1) + glue + now.getDate();

//    writterToFile = new (winston.Logger)({
//        transports: [new (winston.transports.File)({
//            filename : config.logs.path +  botPID + glue + nowDate + config.logs.fileExt,
//            silent : false,
//            level : 'debug',
//            colorize : false,
//            timestamp : true,
//            maxFiles : 5,
//            json : false
//        })],
//        exitOnError: true
//    });

//    writterToFile.on('error', function(err) {
//        writterToStdout.error(err);
//    });


    writterToMongo = new (winston.Logger)({
        transports: [new (mongoLog)({
            host : config.mongo.host,
            port : config.mongo.port,
            username : config.mongo.username,
            password : config.mongo.password,
            db : config.mongo.db,
            level : 'debug',
            collection : config.logs.memoryLogTable
            // safe : true,
            // silent : false,
        })],
        exitOnError: false
    });

    writterToStdout = new (winston.Logger)({
        transports : [new (winston.transports.Console)({
            timestamp : true,
            colorize : true,
            silent : false,
            level : 'debug'
        })]
    });

    writterToMongo.on('error', function(err) {
        writterToStdout.error(err);
        writterToFile.error(err);
    });

    loggersBuild = {
        'file' : {},
        'console' : {},
        'mongo' : writterToMongo
    };

    // конфигурируем сборку логгеров
    // после коммита бот не умеет писать в файл самостоятельно, только
    // в stdout, ключи file и console означают скорее detail и modest соответственно,
    // если кто хочет может сделать @todo привести ключи логгеров в соответсвие с режимом логирования
    switch (config.logs.mode) {
        case "modest" :
            loggersBuild.file = new stub();
            loggersBuild.console = writterToStdout;
            break;
        case "detail" :
            loggersBuild.file = writterToStdout;
            loggersBuild.console = new stub();
            break;
        case "none" :
        default :
            loggersBuild.file = new stub();
            loggersBuild.console = new stub();
    }

    return loggersBuild;
}

exports.forge = forge;