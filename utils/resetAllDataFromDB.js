/**
 * Created by dezzpil on 26.12.13.
 */

async               = require('async');
config              = require('./../configs/config.json');
PageStorageDriver   = require('./../driver/mongo');
DomainStorageDriver = require('./../driver/mysql');
loggers             = require('./../driver/loggers');

loggerProcess = loggers.forge(
    config.loggers.process.type,
    config.loggers.process.options
);

pageStorage = null;
domainStorage = null;
storageOptions = {
    'logger' : loggerProcess,
    'config' : config
};

process.on('SIGILL', function() {
    loggerProcess.info('end - error occured');
    process.exit();
});

// Приконнектимся к базам
async.parallel({
    'mysql' : function(callback) {
        domainStorage = new DomainStorageDriver(storageOptions);
        domainStorage.connect(function(err) {
            callback(err, true);
        });
    },
    'mongo' : function(callback) {
        pageStorage = new PageStorageDriver(storageOptions);
        pageStorage.connect(function(err) {
            callback(err, true);
        });
    }
}, function(error, result) {

    loggerProcess.info(result);
    if (error) throw error;

    clearData();
});


function clearData() {

    async.parallel({
        'mysql' : function(callback) {
            domainStorage.resetLinks(function(err, rows) {
                loggerProcess.info('mysq - all rows has been reset');
                callback(err, true);
            });
        },
        'mongo' : function(callback) {
            pageStorage.removeAllPages(function(err) {
                loggerProcess.info('mongo - all documents has been removed');
                callback(err, true);
            });
        }
    }, function(error, result) {

        loggerProcess.info(result);
        if (error) throw error;

        loggerProcess.info('Reseting data - fin success');
        process.exit();
    });

}
