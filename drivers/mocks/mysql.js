/**
 * Created by dezzpil on 10.01.14
 */

var testDataObj = require('./../../configs/mysqlMockData.json');

function mysqlMockDriver() {

    var mysqlConnection = null,
        self = this,
        config = {},
        logger = null;

    this.setLogger = function(object) {
        logger = object;
        return self;
    };

    this.setConfig = function(cfg) {
        config = cfg;
        return self;
    };

    this.connect = function() {
        logger.info('MYSQL - connection established!');
    };

    this.getLinks = function(pid, callback) {
        logger.info('MYSQL : gets data from mysqlMockData.json ...');

        var i, testData = [];

        for (var i in testDataObj) {

            testData[i] = testDataObj[i];

        }

        callback(null, testData);
    };

    this.clearLinks = function(pid, callback) {};

    /**
     * Обнулить все собранные ботом данные
     * Данные восстановить не удасться !!!
     */
    this.resetLinks = function(callback) {
        if (callback) callback();
    };

    this.setStatusForLink = function(idD, statusCode, callback, ip4) {
        self.setInfoForLink(idD, statusCode, 0, 0, callback, ip4);
    };

    this.setLinkRecovered = function(idD, statusCode, callback) {
        if (callback) callback(null, []);
    };

    this.setInfoForLink = function(idD, statusCode, percent, isBad, callback, ip4) {
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

exports.driver = new mysqlMockDriver();