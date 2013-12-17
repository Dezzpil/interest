/**
 * Created by dezzpil on 18.11.13.
 *
 * Модель (суть работы тут)
 * @returns {boolean}
 */


function model() {

    var self = this,
        loggers = null,
        mysql = null,
        mongo = null,
        botPID = 0,
        options = {},
        Analyzer;

    this.setAnalyzerFactory = function(analyzerFactory) {
        Analyzer = analyzerFactory;
        return self;
    };

    this.setOptions = function(opts) {
        options = opts;
        return self;
    };

    this.setLoggers = function(object) {
        loggers = object;
        return self;
    };

    this.setMysqlDriver = function(driver) {
        mysql = driver;
        return self;
    };

    this.setMongoDriver = function(driver) {
        mongo = driver;
        return self;
    };

    this.setBotPID = function(pid) {
        botPID = pid;
        return self;
    };

    /**
     *
     * @param response http://nodejs.org/api/stream.html#stream_readable_stream
     * @param guideBook
     * @returns {boolean}
     */
    this.run = function(response, guideBook) {

        var analyzer = null,
            statusCode = response.statusCode + '',
            link = guideBook.getDomain(),
            idD = guideBook.getIdD(),
            responseBody = '',
            charset = 'utf8';

        // анализатор
        // TODO todo создавать анализатор только после того,
        // TODO как обнаружится что есть новые и предыдущие данные
        analyzer = Analyzer.forge();
        analyzer.run(
            function(analyzeResult) { // readyCallback

                loggers.file.info('%d DATA ANALYZED :', idD);

                mongo.saveNewImpress(guideBook, botPID, charset, responseBody, analyzeResult, function(err, impress){
                    if (err) loggers.file.info('%d MONGO ERROR (impress saving) : ', idD, err);
                    else loggers.file.info('%d IMPRESS SAVED', idD);
                });

                guideBook.markLink(function() {
                    mysql.setInfoForLink(
                        idD, statusCode, analyzeResult.percent, analyzeResult.isBad,
                        function(err, rows) {
                            loggers.file.info('%d MYSQL ROW UPDATED AFTER ANALYZING', idD);
                        }
                    );
                });

            },
            function(err) { // errorCallback

                loggers.file.warn('%d ANALYZER ERROR ', idD, err);

                guideBook.markLink(function() {
                    mysql.setStatusForLink(idD, options.codes.htmlParseError, function(err, rows) {
                        loggers.file.info('%d MYSQL ROW UPDATED WITH ANALYZER ERROR', idD);
                    });
                });

            },
            function(err) { // completeCallback
                loggers.file.warn('%d KILL ANALYZER  (%s)', idD, link, err);
            }
        );

        // http ответ
        response.on('data', function (content) {

            responseBody += content;

        }).on('end', function() {

            // save encoding, for further processes
            if ('content-type' in response.headers) {
                try {
                    charset = response.headers['content-type'].split(';')[1];
                    charset = charset.split('=')[1].trim();
                } catch (e) {
                    charset = 'utf8';
                }
                charset = charset.toUpperCase();
            }

            loggers.file.info('%d CONTENT RECEIVED, %d length', idD, responseBody.length);
            if (responseBody.length) {

                try {
                    analyzer.write(responseBody);
                    loggers.file.info('%d ANALYZER WRITE NEW CONTENT', idD);
                } catch (e) {
                    loggers.file.info('%d ANALYZER PROCESS ALREADY CLOSED', idD, e);

                    mongo.saveNewImpress(guideBook, botPID, charset, responseBody, analyzer.getNoResult(), function(err, impress){
                        if (err) loggers.file.info('%d MONGO ERROR (impress saving) : ', idD, err);
                        else loggers.file.info('%d IMPRESS SAVED', idD);
                    });

                    guideBook.markLink(function(){
                        mysql.setStatusForLink(idD, statusCode, function(err, rows) {
                                loggers.file.info('%d MYSQL ROW UPDATED NEW IMPRESS', idD);
                            }
                        );
                    });
                }

            } else {

                guideBook.markLink(function() {
                    mysql.setStatusForLink(idD, options.codes.requestEmpty, function(err, rows) {
                        loggers.file.info('%d MYSQL ROW UPDATED WITH EMPTY RESPONSE', idD);
                    });
                });
            }


        }).on('close', function() {

            loggers.file.warn('%d RESPONSE HAVE BEEN CLOSED', idD);

        }).on('error', function(err) {

            loggers.file.info('%d HTTP LONG RESPONSE', idD);
            guideBook.markLink(function() {
                mysql.setStatusForLink(idD, options.codes.requestAbbruptly,
                    function(err, rows) {
                        if (err) loggers.console.error(err);
                        loggers.file.info('%d MYSQL ROW UPDATED WITH HTTP LONG RESPONSE', idD);
                    }
                );
            });
        });


        // предыдущие данные
        mongo.getImpress(idD, function(err, result) {

            if (err) loggers.file.info('%d MONGO ERROR (find prev data) : ', idD, err);

            if (result && result.length) {

                try {
                    analyzer.write(result[0].content);
                    loggers.file.info('%d GOT PREVIOUS DATA', idD);
                } catch (e) {
                    loggers.file.error('%d PREVIOUS DATA IS BAD', idD, e);
                    guideBook.markLink(function() {
                        mysql.setStatusForLink(idD, statusCode, function(err, rows) {
                            loggers.file.info('%d MYSQL ROW UPDATED WITHOUT ANALYZING (bad data)', idD);
                        });
                    });
                }

            } else {

                // нет данных для сравнения, но нам нужно узнать о наличии мата все-равно
                loggers.file.info('%d NO PREVIOUS DATA', idD);
                analyzer.write(responseBody);

                //guideBook.markLink(function() {
                    mysql.setStatusForLink(idD, statusCode, function(err, rows) {
                        loggers.file.info('%d MYSQL ROW UPDATED WITH STOP-LIST ANALYZE (no prev data)', idD);
                    });
                //})

            }

        });

        return true;
    }
}


exports.init = model;