/**
 * Created by dezzpil on 10.01.14
 */

var testDataObj = require('./../../configs/mysqlMockData.json');

function mysqlMockDriver(options) {

    var self = this,
        logger = options.logger,
        config = options.config.mysql;

    this.connect = function(callback) {
        logger.info('MYSQL : connection established');
        callback(null);
    };

    this.getLinks = function(pid, count, callback) {
        logger.info('MYSQL : gets data from mysqlMockData.json ...');

        var i, testData = [];

        for (i in testDataObj) {
            testData[i] = testDataObj[i];
        }

        callback(null, testData);
    };

    this.unlockLinks = function(pid, callback) {
        callback(null, []);
    };

    /**
     * Обнулить все собранные ботом данные
     * Данные восстановить не удасться !!!
     */
    this.resetLinks = function(callback) {
        if (callback) callback();
    };

    this.setStatusForLink = function(guidebook, statusCode, callback) {
        self.setInfoForLink(guidebook, statusCode, 0, 0, callback);
    };

    this.setLinkRecovered = function(guidebook, statusCode, callback) {
        if (callback) callback(null, []);
    };

    this.setInfoForLink = function(guidebook, statusCode, percent, isBad, callback) {
        if (callback) callback(null, []);
    };

    /**
     * @param dateStart {string}
     * @param callback {fn}
     */
    this.getStats = function(dateStart, callback) {
        callback({});
    }

};

module.exports = mysqlMockDriver;