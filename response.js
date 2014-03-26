/**
 * Created by dezzpil on 18.11.13.
 *
 * Модель обработки тела ответа
 * @returns {boolean}
 */

var exec = require('child_process').exec;

/**
 *
 * @param {Analyzer} analyzer
 * @param {object} options
 */
function model(analyzer, options) {

    var self = this,
        hooks = {'response' : null, 'recode' : null},
        logger = options.logger,
        mysql = options.mysql,
        mongo = options.mongo,
        botPID = options.pid,
        options = options.config,
        Analyzer = analyzer;

    /**
     * Set handlers on events. List [recodeEnd, responseEnd]
     * @param eventName
     * @param fn
     * @returns {model}
     */
    self.on = function(eventName, fn) {
        if ( ! (eventName in hooks)) {
            hooks[eventName] = null;
        }

        hooks[eventName] = fn;
        return self;
    };

    /**
     * Выполнить хук по указанному событию
     * @param {string} eventName
     * @param {string} data
     * @returns {string}
     */
    function invokeHooks(eventName, data) {
        if (hooks[eventName]) {
            data = hooks[eventName](data);
        }
        return data;
    }

    self.create = function() {

        var guideBook, link, idD,
            response, statusCode, responseBody = '',
            _charset = 'utf8';

        /**
         * Установить определенную кодировку текста
         * @param {string} charset
         */
        function setCharset(charset) {
            _charset = charset;
        }

        /**
         * Получить определенную кодировку текста
         * @returns {string}
         */
        function getCharset() {
            return _charset;
        }

        /**
         * Wrapper for Analyzer instance
         * @param responseEncodedBody {string}
         */
        function analyzerInit(responseEncodedBody) {

            Analyzer.run(
                function(analyzeResult) { // readyCallback

                    logger.info('%s DATA ANALYZED :', idD);

                    saveDataToMongo(responseEncodedBody, getCharset(), '', analyzeResult);

                    guideBook.markLink(function() {
                        mysql.setInfoForLink(
                            idD, statusCode, analyzeResult.percent, analyzeResult.isBad,
                            function(err, rows) {
                                logger.info('%s MYSQL ROW UPDATED AFTER ANALYZING', idD);
                            }
                        );
                    });

                },
                function(err) { // errorCallback

                    logger.info('%s ANALYZER ERROR ', idD, err);

                    guideBook.markLink(function() {
                        mysql.setStatusForLink(idD, options.codes.htmlParseError, function(err, rows) {
                            logger.info('%s MYSQL ROW UPDATED WITH ANALYZER ERROR', idD);
                        });
                    });

                },
                function(errKilling) { // completeCallback
                    logger.info('%s KILL ANALYZER  (%s)', idD, link, errKilling);
                }
            );
        }

        /**
         * Catch error on exec some library and save data in mysql for link with error
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
                            logger.info('%s MYSQL ROW UPDATED WITH EXEC ERROR', guideBook.getIdD(), (err || stderr));
                        }
                    );
                });

                return true;
            }

            return false;
        }

        /**
         * Wrapper for saving data in mongo
         * @param encodedResponseBody
         * @param charset
         */
        function saveDataToMongo(encodedResponseBody, charset, desc, analyzeResult) {

            if ( ! desc) desc = 'default case';
            if ( ! analyzeResult) analyzeResult = AnalyzerFactory.getNoResult();

            mongo.savePage(
                guideBook, botPID, charset, encodedResponseBody, analyzeResult,
                function(err, impress) {
                    if (err) logger.info('%s MONGO ERROR (impress saving) : ', idD, err);
                    else logger.info('%s IMPRESS SAVED : %s', idD, desc);
                }
            );

        }

        /**
         * Send data to analyzer for checkout about diff or presence of bad words
         * @param encodedResponseBody
         */
        function pullDataToAnalyzer(encodedResponseBody) {

            // new data
            AnalyzerFactory.write(encodedResponseBody);
            logger.info('%s WRITING NEW CONTENT TO ANALYZER ', idD);

            // предыдущие данные
            mongo.findPagesById(idD, function(err, result) {

                if (err) logger.info('%s MONGO ERROR (find prev data) : ', idD, err);

                if (result && result.length) {

                    AnalyzerFactory.write(result[0].content);
                    logger.info('%s GOT PREVIOUS DATA', idD);

                } else {

                    // нет данных для сравнения, но нам нужно узнать о наличии мата все-равно
                    logger.info('%s NO PREVIOUS DATA', idD);
                    AnalyzerFactory.write(encodedResponseBody);

                }

            });

        }

        /**
         * Init common logic for response on link
         * @param {http.ServerResponse} Response
         * @param {linkGuideBook} Guidebook
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

                responseBody += content;

            }).on('end', function() {

                if ( ! responseBody || ! responseBody.length) {
                    return guideBook.markLink(function() {
                        mysql.setStatusForLink(idD, options.codes.requestEmpty, function(err, rows) {
                            logger.info('%s MYSQL ROW UPDATED WITH EMPTY RESPONSE', idD);
                        });
                    });
                }

                responseBody = invokeHooks('response', responseBody);

                var execOptions = {}, chardetector;

                execOptions = {
                    encoding : 'binary',
                    timeout: options.charsetProcessing.timeoutInSec * 1000,
                    maxBuffer: options.charsetProcessing.maxBufferInKb * 1024,
                    killSignal: options.charsetProcessing.killSignal,
                    cwd: options.charsetProcessing.cwd,
                    env: options.charsetProcessing.env
                };

                // start character detection
                chardetector = exec(
                    options.path + options.charsetProcessing.detectionName,
                    execOptions,
                    function(err, stdout, stderr) {

                        if (catchExecErrors(err, stderr,
                            options.codes.errorWhenChardet)) return ;

                        var encoder,
                            charset = stdout.match(/:(.*)\(/)[1].trim().toLowerCase();

                        switch (charset) {
                            // remarks for charset names
                            case 'koi8-r' : charset = 'koi8-ru';
                                break;
                        }

                        //setCharset(charset);
                        logger.info('%s CHARSET -> %s', idD, charset);

                        // start encoding (using only recode)
                        encoder = exec(
                            options.charsetProcessing.recodeName + ' ' + charset + '..utf-8',
                            execOptions,
                            function(err, stdout, stderr) {

                                if (catchExecErrors(err, stderr,
                                    options.codes.errorWhenEncode)) return ;

                                stdout = invokeHooks('recode', stdout);

                                // TODO перенести эту логику в отдельный модуль
                                // analyzerInit(stdout);
                                // pullDataToAnalyzer(stdout);
                            }
                        );

                        // pull data to chosen encoder
                        encoder.stdout.setEncoding('utf8');
                        encoder.stdin.end(responseBody, 'binary');

                    }
                );

                // pull data to chosen character detector
                logger.info('%s CONTENT RECEIVED, %d length', idD, responseBody.length);
                chardetector.stdin.end(responseBody, 'binary');


            }).on('error', function(err) {

                logger.info('%s HTTP ', idD, err);
                guideBook.markLink(function() {
                    mysql.setStatusForLink(idD, options.codes.requestAbbruptly,
                        function(err, rows) {
                            if (err) logger.console.error(err);
                            logger.info('%s MYSQL ROW UPDATED WITH HTTP ERROR', idD);
                        }
                    );
                });


            });

            return true;
        }
    }
}


exports.factory = model;