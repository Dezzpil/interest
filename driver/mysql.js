/**
 * Created by dezzpil on 21.11.13.
 */

var mysql = require('mysql');

function mysqlDriver(options) {

    var self = this, 
        mysqlConnection,
        logger = options.logger,
        config = options.config.mysql,
        tableName = config.dbName + '.' + config.tableName;

    self.connect = function(callback) {

        mysqlConnection = mysql.createConnection(config);
        mysqlConnection.connect(function(err) {
            var t;

            if (err) { // use for reconnect
                t = setTimeout( function() {
                    clearTimeout(t);
                    self.connect();
                }, config.options.reconnectAfterInSec * 1000);
            } else {
                logger.info('MYSQL : connection established');
                if (callback) callback(null);
            }
        });

        /**
         * Connection to the MySQL server is usually lost due to either server restart,
         * or a connnection idle timeout (the wait_timeout server variable configures this)
         */
        mysqlConnection.on('error', function(err) {
            if(err.code === 'PROTOCOL_CONNECTION_LOST') {
                self.connect();
            } else {
                if (callback) callback(err);
            }
        });
    };

    /**
     * Get links data from config.dbName + '.' + config.tableName
     * where now() - lastRechange > config.options.timeToReprocessInSec
     * and were tested before lastRechange
     *
     * @param {String} pid
     * @param {Number} count
     * @param {Function} callback
     */
    self.getLinks = function(pid, count, callback) {

        var queryUp, queryGet,
            diff = config.options.timeToReprocessInSec;

        queryUp = 'UPDATE ' + tableName + ' set idProcess=' + pid + ' WHERE idProcess=0';
        if (config.options.onlyGroup != 0) {
            queryUp += ' && groups LIKE "%' + config.options.onlyGroup + '%"'
        }
        queryUp += ' && UNIX_TIMESTAMP(NOW())-UNIX_TIMESTAMP(lastRechange)>' + diff +
            ' && UNIX_TIMESTAMP(lastTest)<UNIX_TIMESTAMP(lastRechange)' +
            ' ORDER BY lastTest ASC LIMIT ' + count;

        queryGet =  'SELECT * FROM ' + tableName + ' WHERE idProcess=' + pid +
            ' ORDER BY lastTest ASC';

        logger.info('MYSQL : getting links...');
        mysqlConnection.query(queryUp,
            function(err, rows) {

                if (err) callback(err, null);
                else if (rows && ('changedRows' in rows) && rows.changedRows > 0) {

                    mysqlConnection.query(
                        queryGet,
                        function(err, rows) {
                            callback(err, rows);
                        }
                    );

                } else {

                    var d = setTimeout(function() {
                        clearTimeout(d);
                        self.getLinks(pid, count, callback);
                    }, config.options.timeOutForRetryInSec * 100)

                }
            }
        );
    };

    /**
     * Set idProcess = 0 to all rows where idProcess = pid
     * if pid == null, unlock all links. Actually only on bot restart.
     * @param {int|null} pid
     * @param {Function} callback
     */
    self.unlockLinks = function(pid, callback) {
        var query = 'UPDATE ' + tableName + ' set idProcess=0 ';
        if (pid === null) {
            query += 'WHERE idProcess!=0';
        } else {
            query += 'WHERE idProcess=' + pid;
        }

        mysqlConnection.query(query, function(err, rows) {
            if (callback) callback(err, rows);
        });
    };

    /**
     * Обнулить все собранные ботом данные
     * Данные восстановить не удасться !!!
     * @param callback {Function}
     */
    self.resetLinks = function(callback) {
        mysqlConnection.query(
            'UPDATE ' + tableName + ' SET ? ', {
                lastTest : '2012-01-01 00:00:00',
                lastRechange : '2012-01-02 00:00:00',
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

    /**
     *
     * @param idD {Integer}
     * @param statusCode {Integer}
     * @param callback {Function}
     */
    self.setStatusForLink = function(guidebook, statusCode, callback) {
        self.setInfoForLink(guidebook, statusCode, 0, 0, callback);
    };

    /**
     *
     * @param idD {Integer}
     * @param statusCode {Integer}
     * @param callback {Function}
     */
    self.setLinkRecovered = function(guidebook, statusCode, callback) {

        if (guidebook.isSub()) {
            return callback(null, null);
        }
        var idD = guidebook.getIdD();
        mysqlConnection.query(
            'UPDATE '+ tableName +' SET ? WHERE idD="' + idD + '"', {
                statusRecovery : 1
            },
            function(err, rows) {
                if (callback) callback(err, rows);
            }
        );
    };

    /**
     *
     * @param idD {Integer}
     * @param statusCode {Integer}
     * @param percent {Integer}
     * @param isBad {Boolean}
     * @param callback {Function}
     */
    self.setInfoForLink = function(guidebook, statusCode, percent, isBad, callback) {

        if (guidebook.isSub()) {
            return callback(null, null);
        }

        var idD = guidebook.getIdD();
        mysqlConnection.query(
            'UPDATE '+ tableName +' SET ? WHERE idD="' + idD + '"', {
                idProcess : 0,
                lastTest : new Date(),
                statusCode : statusCode,
                persent : (percent ? percent : 0),
                bad : (isBad ? isBad : 0)
            },
            function(err, rows) {
                if (callback) callback(err, rows);
            }
        );
    };

    /**
     * @todo HOWTO ?
     * @todo переделать к чертовой матери
     * @param dateStart {String}
     * @param callback {Function}
     */
    self.getStats = function(dateStart, callback) {

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

module.exports = mysqlDriver;