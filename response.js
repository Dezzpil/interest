/**
 * Created by dezzpil on 18.11.13.
 *
 * Модель (суть работы тут)
 * @returns {boolean}
 */

var exec = require('child_process').exec;

function model() {

    var self = this,
        loggers = null,
        mysql = null,
        mongo = null,
        botPID = 0,
        options = {},
        hooks = {},
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


    this.on = function(eventName, fn) {
        if ( ! (eventName in hooks)) {
            hooks[eventName] = [];
        }

        hooks[eventName].push(fn);
        return self;
    };

    /**
     *
     * @param response http://nodejs.org/api/stream.html#stream_readable_stream
     * @param guideBook
     * @returns {boolean}
     */
    this.create = function() {

        var guideBook, link, idD,
            response, statusCode, responseBody = '',
            responseEncodedBody,
            analyzer,
            _charset = 'utf8';


        function setCharset(charset) {
            _charset = charset;
        }


        function getCharset() {
            return _charset;
        }


        /**
         * Wrapper for Analyzer instance
         *
         * @param responseEncodedBody {string}
         * @param charset {string}
         */
        function analyzerInit(responseEncodedBody, charset) {

            analyzer = Analyzer.forge();

            analyzer.run(
                function(analyzeResult) { // readyCallback

                    loggers.file.info('%d DATA ANALYZED :', idD);

                    saveDataToMongo(responseEncodedBody, getCharset(), '', analyzeResult);

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
                function(errKilling) { // completeCallback
                    loggers.file.warn('%d KILL ANALYZER  (%s)', idD, link, errKilling);
                }
            );
        }


        /**
         *
         * @param guideBook
         * @param err
         * @param stderr
         * @param code
         * @returns {boolean}
         */
        function catchExecErrors(err, stderr, code) {

            if (err || stderr) {

                guideBook.markLink(function() {
                    mysql.setStatusForLink(
                        guideBook.getIdD(), code,
                        function(err, rows) {
                            loggers.file.info('%d MYSQL ROW UPDATED WITH EXEC ERROR', guideBook.getIdD(), (err || stderr));
                        }
                    );
                });

                return true;
            }

            return false;
        }


        /**
         *
         * @param encodedResponseBody
         * @param charset
         */
        function saveDataToMongo(encodedResponseBody, charset, desc, analyzeResult) {

            if ( ! desc) desc = 'default case';
            if ( ! analyzeResult) analyzeResult = analyzer.getNoResult();

            mongo.saveNewImpress(
                guideBook, botPID, charset, encodedResponseBody, analyzeResult,
                function(err, impress) {
                    if (err) loggers.file.info('%d MONGO ERROR (impress saving) : ', idD, err);
                    else loggers.file.info('%d IMPRESS SAVED : %s', idD, desc);
                }
            );

        }


        /**
         *
         * @param encodedResponseBody
         */
        function pullDataToAnalyzer(encodedResponseBody) {

            // new data
            analyzer.write(encodedResponseBody);
            loggers.file.info('%d ANALYZER WRITE NEW CONTENT', idD);

            // предыдущие данные
            mongo.getImpress(idD, function(err, result) {

                if (err) loggers.file.info('%d MONGO ERROR (find prev data) : ', idD, err);

                if (result && result.length) {

                    analyzer.write(result[0].content);
                    loggers.file.info('%d GOT PREVIOUS DATA', idD);

                } else {

                    // нет данных для сравнения, но нам нужно узнать о наличии мата все-равно
                    loggers.file.info('%d NO PREVIOUS DATA', idD);
                    analyzer.write(encodedResponseBody);

                }

            });

        }


        /**
         *
         * @param err
         * @param stdout
         * @param stderr
         */
        function handleEncoding(err, stdout, stderr) {

            var charset = getCharset();

            if (catchExecErrors(err, stderr,
                options.codes.errorWhenEncode)) return ;

            for (i in hooks.recodeEnd) {
                hooks.recodeEnd[i](stdout);
            }

            analyzerInit(stdout, charset);
            pullDataToAnalyzer(stdout);

            return ;
        }

        /**
         * Methods
         */


        /**
         *
         * @param Response {http.IncomingMessage}
         * @param Guidebook {linkGuide.getGuideBook()}
         * @returns {boolean}
         */
        this.run = function(Response, Guidebook) {

            guideBook = Guidebook;
            response = Response;
            statusCode = response.statusCode + '';
            link = guideBook.getDomain();
            idD = guideBook.getIdD();

            // http ответ
            response.on('data', function (content) {


                // collect chunks of response data
                responseBody += content;


            }).on('end', function() {


                if ( ! responseBody || ! responseBody.length) {
                    return guideBook.markLink(function() {
                        mysql.setStatusForLink(idD, options.codes.requestEmpty, function(err, rows) {
                            loggers.file.info('%d MYSQL ROW UPDATED WITH EMPTY RESPONSE', idD);
                        });
                    });
                }

                responseEncodedBody = responseBody;

                for (i in hooks.responseEnd) {
                    hooks.responseEnd[i](responseBody);
                }

                var execOptions = {
                    encoding : 'binary',
                    timeout: options.charsetProcessing.timeoutInSec * 1000,
                    maxBuffer: options.charsetProcessing.maxBufferInKb * 1024,
                    killSignal: options.charsetProcessing.killSignal,
                    cwd: options.charsetProcessing.cwd,
                    env: options.charsetProcessing.env
                },
                    chardet = exec(
                        options.path + options.charsetProcessing.detectionName,
                        execOptions,
                        function(err, stdout, stderr) {

                            if (catchExecErrors(err, stderr,
                                options.codes.errorWhenChardet)) return ;

                            var encodeCommand,
                                charset = stdout.match(/:(.*)\(/)[1].trim().toLowerCase();

                            switch (charset) {
                                // remarks for charset names
                                case 'koi8-r' : charset = 'koi8-ru';
                                    break;
                            }

                            setCharset(charset);
                            loggers.file.info('%s CHARSET -> %s', idD, charset);

                            // using only recode
                            encodeCommand = exec(
                                options.charsetProcessing.recodeName + ' ' + charset + '..utf-8',
                                execOptions,
                                handleEncoding
                            );

                            // pull data to chosen encoder
                            encodeCommand.stdout.setEncoding('utf8');
                            encodeCommand.stdin.end(responseBody, 'binary');

                        }
                    );

                // run response body processing
                loggers.file.info('%d CONTENT RECEIVED, %d length', idD, responseBody.length);
                chardet.stdin.end(responseBody, 'binary');


            }).on('error', function(err) {


                loggers.file.info('%d HTTP ', idD, err);
                guideBook.markLink(function() {
                    mysql.setStatusForLink(idD, options.codes.requestAbbruptly,
                        function(err, rows) {
                            if (err) loggers.console.error(err);
                            loggers.file.info('%d MYSQL ROW UPDATED WITH HTTP ERROR', idD);
                        }
                    );
                });


            });

            return true;
        }
    }
}


exports.factory = model;