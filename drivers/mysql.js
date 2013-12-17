/**
 * Created by dezzpil on 21.11.13.
 */

var mysql = require('mysql'),
    systemCfg = require('./../configs/config.json');

function mysqlDriver() {

    var mysqlConnection,
        self = this,
        config = systemCfg.mysql,
        loggers = null;

    this.setLoggers = function(object) {
        loggers = object;
        return self;
    };

    this.connect = function() {
        mysqlConnection = mysql.createConnection(config);   // Recreate the connection, since
                                                            // the old one cannot be reused.
        mysqlConnection.connect(function(err) {
            loggers.console.info('connection to MYSQL...');    // The server is either down
            if (err) {
                loggers.console.info('connection to MYSQL error : %s',err.code);
                loggers.file.error(err);                       // or restarting (takes a while sometimes).
                var t = setTimeout( function() {
                        clearTimeout(t);
                        self.connect();
                    },
                    config.options.reconnectAfterInSec * 1000);       // We introduce a delay before attempting to reconnect,
            } else {
                loggers.console.info('connection to MYSQL established');
                loggers.file.info('MYSQL - connection established!');
            }

        });                                     // process asynchronous requests in the meantime.
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

    this.setStatusForLink = function(idD, statusCode, callback) {
        self.setInfoForLink(idD, statusCode, 0, 0, callback);
    };

    this.setLinkRecovered = function(idD, statusCode, callback) {
        mysqlConnection.query(
            'UPDATE '+ (config.dbName + '.' + config.tableName) +' SET ? WHERE idD="' + idD + '"',
            { statusRecovery : 1 },
            function(err, rows) {
                if (callback) callback(err, rows);
            }
        );
    }

    this.setInfoForLink = function(idD, statusCode, percent, isBad, callback) {
        mysqlConnection.query(
            'UPDATE '+ (config.dbName + '.' + config.tableName) +' SET ? WHERE idD="' + idD + '"',
            {
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
    }

};

exports.driver = new mysqlDriver();