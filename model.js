/**
 * Created by dezzpil on 18.11.13.
 *
 */

/**
 * Модель (суть работы тут)
 * @param response
 * @param guideBook
 * @returns {boolean}
 * @todo создавать анализатор только
 *      после того, как обнаружится что есть
 *      новые и предыдущие данные
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
            responseBody = '';

        // запускаем процесс анализатора, чтобы тот ждал данных для анализа
        analyzer = Analyzer.forge();
        analyzer.run(
            function(analyzeResult) { // readyCallback

                loggers.file.info('%d DATA ANALYZED :', idD);
                mysql.setInfoForLink(
                    idD, statusCode, analyzeResult.percent, analyzeResult.isBad,
                    function(err, rows) {
                        loggers.file.info('%d MYSQL ROW UPDATED AFTER ANALYZING', idD);
                        guideBook.markLink();
                    }
                );

            },
            function(err) { // errorCallback

                loggers.file.warn('%d ANALYZER ERROR ', idD, err);

            },
            function(err) { // completeCallback

                if (err) {
                    loggers.file.warn('%d ANALYZER ALREADY KILLED (%s) [%s]', idD, link, err);
                } else {
                    loggers.file.info('%d KILL ANALYZER (%s)', idD, link);
                }
            }
        );


        // новые данные
        response
            .on('data', function (content) {

                responseBody += content;

            })
            .on('end', function() {

                loggers.file.info('%d CONTENT RECEIVED, %d length', idD, responseBody.length);
                if (responseBody.length) {

                    try {
                        analyzer.write(responseBody);
                        loggers.file.info('%d ANALYZER WRITE NEW CONTENT', idD);
                    } catch (e) {
                        loggers.file.info('%d ANALYZER PROCESS ALREADY CLOSED', idD, e);
                        mysql.setStatusForLink(idD, statusCode, function(err, rows) {
                                loggers.file.info('%d MYSQL ROW UPDATED NEW IMPRESS', idD);
                                guideBook.markLink();
                            }
                        );
                    }

                    mongo.saveNewData(guideBook, botPID, responseBody, function(err, impress){
                        if (err) loggers.file.info('%d MONGO ERROR (impress saving) : ', idD, err);
                        else loggers.file.info('%d IMPRESS SAVED', idD);
                    });

                } else {

                    mysql.setStatusForLink(idD, options.request.codes.empty, function(err, rows) {
                        loggers.file.info('%d MYSQL ROW UPDATED WITH EMPTY RESPONSE', idD);
                        guideBook.markLink();
                    });

                }


            })
            .on('close', function() {
                loggers.file.warn('%d RESPONSE HAVE BEEN CLOSED', idD);
            })
            .on('error', function(err) {
                loggers.file.info('%d HTTP LONG RESPONSE', idD);

                mysql.setStatusForLink(idD, options.request.codes.abbruptly,
                    function(err, rows) {
                        if (err) loggers.console.error(err);
                        loggers.file.info('%d MYSQL ROW UPDATED WITH HTTP LONG RESPONSE', idD);
                        guideBook.markLink();
                    }
                );
            });


        // предыдущие данные
        mongo.findPrevData(idD, function(err, result) {

            if (err) loggers.file.info('%d MONGO ERROR (find prev data) : ', idD, err);

            if (result && result.length) {

                try {
                    analyzer.write(result[0].content);
                    loggers.file.info('%d GOT PREVIOUS DATA', idD);
                } catch (e) {
                    loggers.file.error('%d PREVIOUS DATA IS BAD', idD, e);
                    mysql.setStatusForLink(idD, statusCode, function(err, rows) {
                        loggers.file.info('%d MYSQL ROW UPDATED WITHOUT ANALYZING', idD);
                        guideBook.markLink();
                    });
                }

            } else {

                // нет данных для сравнения, сохранаяем результат без них
                loggers.file.info('%d NO PREVIOUS DATA', idD);
                analyzer.killAnalyzer(function(err) {
                    loggers.file.info('%d NO PREVIOUS DATA - KILL ANALYZER MANUALLY', idD);
                });

                mysql.setStatusForLink(idD, statusCode, function(err, rows) {
                    loggers.file.info('%d MYSQL ROW UPDATED WITHOUT ANALYZING', idD);
                    guideBook.markLink();
                });
            }

        });

        return true;
    }
}


exports.init = model;