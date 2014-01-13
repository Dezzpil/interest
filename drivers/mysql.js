/**
 * Created by dezzpil on 21.11.13.
 */

var mysql = require('mysql');

function mysqlDriver() {

    var mysqlConnection,
        self = this,
        config = {},
        loggers = null;

    this.setLoggers = function(object) {
        loggers = object;
        return self;
    };

    this.setConfig = function(cfg) {
        config = cfg;
        return self;
    };

    this.connect = function(callback) {
        mysqlConnection = mysql.createConnection(config);   // Recreate the connection, since
                                                            // the old one cannot be reused.
        mysqlConnection.connect(function(err) {
            if (err) {
                if (callback) callback(err);
                var t = setTimeout( function() {
                        clearTimeout(t);
                        self.connect();
                    },
                    config.options.reconnectAfterInSec * 1000);       // We introduce a delay before attempting to reconnect,
            } else {
                if (callback) callback();
            }
        });                                     // process asynchronous request in the meantime.
        // If you're also serving http, display a 503 error.
        mysqlConnection.on('error', function(err) {
            loggers.file.error(err);
            if(err.code === 'PROTOCOL_CONNECTION_LOST') {   // Connection to the MySQL server is usually
                self.connect();                             // lost due to either server restart, or a
            } else {                                        // connnection idle timeout (the wait_timeout
                throw err;                                  // server variable configures this)
            }
        });
    };

    this.links = function(pid, callback, errorCallback) {

        loggers.file.info('MYSQL - getting links...');

        mysqlConnection.query(
            'UPDATE ' + config.dbName + '.' + config.tableName + ' set idProcess=' + pid +
                ' WHERE ' +
                    'idProcess=0 ' +
                    '&& UNIX_TIMESTAMP(NOW())-UNIX_TIMESTAMP(lastTest) > ' + (config.options.timeToReprocessInSec) +
                    '&& UNIX_TIMESTAMP(lastTest) <= UNIX_TIMESTAMP(lastRechange) ' +
                ' ORDER BY lastTest ASC' +
                ' LIMIT ' + config.options.maxProcessLimit,
            function(err, rows) {

                if (err) {
                    if (errorCallback) errorCallback(err); else loggers.file.error(err);
                }

                if (rows && ('changedRows' in rows) && rows.changedRows > 0) {

                    mysqlConnection.query(
                        'SELECT * FROM ' + config.dbName + '.' + config.tableName +
                            ' WHERE idProcess=' + pid +
                            ' ORDER BY lastTest ASC',
                        function(err, rows) {
                            if (err) {
                                if (errorCallback) errorCallback(err); else loggers.file.error(err);
                            }
                            callback(rows);
                        }
                    );

                } else {

                    var d = setTimeout(function() {
                        clearTimeout(d);
                        loggers.console.info('MYSQL get no item to process, idle...');
                        self.links(pid, callback, errorCallback);
                    }, config.options.timeOutForRetryInSec * 100)

                }
            }
        );
    };

    this.clearLinks = function(pid, callback) {
        mysqlConnection.query(
            'UPDATE ' + config.dbName + '.' + config.tableName + ' set idProcess=0 ' +
            'WHERE idProcess=' + pid,
            function(err, rows) {
                if (callback) callback(err, rows);
            }
        );
    };

    /**
     * Обнулить все собранные ботом данные
     * Данные восстановить не удасться !!!
     */
    this.resetLinks = function(callback) {
        mysqlConnection.query(
            'UPDATE ' + config.dbName + '.' + config.tableName + ' SET ? ',
            {
                lastTest : '2012-01-01 00:00:00',
                lastRechange : '2022-01-01 00:00:00',
                idProcess : 0,
                statusCode : 0,
                persent: 0,
                bad: 0,
                statusRecovery: 0
            },
            function(err, rows) {
                if (callback) callback(err, rows);
            }
        );
    };

    // TODO programm dataStorage and drivers for it

    // TODO fix signature
    this.setStatusForLink = function(idD, statusCode, callback, ip4) {
        self.setInfoForLink(idD, statusCode, 0, 0, callback, ip4);
    };

    this.setLinkRecovered = function(idD, statusCode, callback) {
        mysqlConnection.query(
            'UPDATE '+ (config.dbName + '.' + config.tableName) +' SET ? WHERE idD="' + idD + '"',
            { statusRecovery : 1 },
            function(err, rows) {
                if (callback) callback(err, rows);
            }
        );
    };

    // TODO fix signature
    this.setInfoForLink = function(idD, statusCode, percent, isBad, callback, ip4) {
        mysqlConnection.query(
            'UPDATE '+ (config.dbName + '.' + config.tableName) +' SET ? WHERE idD="' + idD + '"',
            {
                idProcess : 0,
                lastTest : new Date(),
                statusCode : statusCode,
                persent : (percent ? percent : 0),
                bad : (isBad ? isBad : 0),
                ip : (ip4 ? ip4 : 0)
            },
            function(err, rows) {
                if (callback) callback(err, rows);
            }
        );
    };

    /**
     * @todo refactoring
     * @param dateStart {string}
     * @param callback {fn}
     */
    this.getStats = function(dateStart, callback) {

        var results = {},
            wait = setInterval(function() {

                var resultsCount = 0,
                    i = 0, prop,
                    list = ['fullNum', 'processedNum', 'startTime', 'endTime', 'statusCode'];

                for (prop in list) {
                    resultsCount++;
                    if (list[prop] in results) {
                        i++;
                    }
                }

                if (i == resultsCount) {
                    clearInterval(wait);
                    callback(results);
                }

            }, 1000);


        mysqlConnection.query(
            'select count(*) from ' + config.dbName + '.' + config.tableName,
            function(err, result) {
                if (err) return results.fullNum = err;
                results.fullNum = result;
            }
        );

        mysqlConnection.query(
            'select count(*) from ' + config.dbName + '.' + config.tableName + ' where lastTest > "' + dateStart + '"',
            function(err, result) {
                if (err) return results.processedNum = err;
                results.processedNum = result;
            }
        );

        mysqlConnection.query(
            'select lastTest from ' + config.dbName + '.' + config.tableName + ' order by lastTest ASC limit 1',
            function(err, result) {
                if (err) return results.startTime = err;
                results.startTime = result;
            }
        );

        mysqlConnection.query(
            'select lastTest from ' + config.dbName + '.' + config.tableName + ' order by lastTest DESC limit 1',
            function(err, result) {
                if (err) return results.endTime = err;
                results.endTime = result;
            }
        );

        mysqlConnection.query(
            'select statusCode, count(*) from ' + config.dbName + '.' + config.tableName + ' where lastTest > "' + dateStart + '" group by statusCode',
            function(err, result) {
                if (err) return results.statusCode = err;
                results.statusCode = result;
            }
        );

    }

};

exports.driver = new mysqlDriver();