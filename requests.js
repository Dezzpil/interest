/**
 * Created by dezzpil on 29.11.13.
 */

var http = require('http'),
    https = require('https'),
    url = require('url');

function requestsManager() {

    var self = this,
        loggers = null,
        mysql = null,
        modelCallback = null,
        stepToDeep = 0,
        config = {},
        reqConfig = {
            "redirectDeep" : 3,
            "timeoutInMS" : 10000
        },
        reqOptions = {
            hostname: 'bash.im',
            port: 80,
            path: '/',
            method: 'GET',
            headers: {
                'user-agent' : '',
                'connection' : 'keep-alive'
            }
        };

    this.setLoggers = function(object) {
        loggers = object;
        return self;
    };

    this.setMysqlDriver = function(driver) {
        mysql = driver;
        return self;
    };

    this.setOptions = function(options) {
        config = options;
        reqConfig = config.request;
        return self;
    };

    this.setUserAgent = function(name) {
        reqOptions.headers['user-agent'] = name;
        return self;
    };

    this.setModel = function(fn) {
        modelCallback = fn;
        return self;
    };

    /**
     * Запускает и возвращает соотв. запрос (http or https)
     * исходя из указанных параметров в reqOpts
     * @param reqOpts
     * @param callback
     * @returns {*}
     */
    function makeRequest(reqOpts, callback) {
        var request;
        if (reqOpts.port == 443) {
            request = https.request(reqOpts, callback);
        } else {
            request = http.request(reqOpts, callback);
        }

        return request;
    }

    /**
     *
     * @param request
     */
    function terminateRequest(request) {
        try {
            request.end();
            request.abort();
        } catch (e) {
            //
        }
    }

    /**
     *
     * @param response
     * @param guideBook
     * @returns {boolean}
     */
    function redirect(response, guideBook) {
        if ('location' in response.headers) {

            var reqOpts =  reqOptions,
                redirectUrl = url.parse(response.headers.location);

            // коды 300, пробуем перейти по редиректу reqConfig.redirectDeep раз
            if (redirectUrl.protocol && redirectUrl.protocol == 'https:') {
                reqOpts.port = 443;
            }

            if (redirectUrl.hostname)
                reqOpts.hostname = redirectUrl.hostname;

            reqOpts.path = redirectUrl.path;

            self.run(guideBook, reqOpts, (stepToDeep+1));
            return true;
        }
        return false;
    }

    function isBadStatusCode(statusCode) {
        return statusCode.indexOf('5') == 0 || statusCode.indexOf('4') == 0 || statusCode.indexOf('9') == 0;
    }



    /**
     * Контроллер запросов,
     * следит за процессами обращения по адресам,
     * пытается получить данные для модели
     *
     * @param guideBook
     * @param request [optional]
     * @param deep [optional]
     * @returns {boolean}
     */
    this.run = function(guideBook, request, deep) {

        var reqOpts = {},
            idD = guideBook.getIdD(),
            link = guideBook.getDomain(),
            req = null;

        stepToDeep = deep ? deep : 0;

        if (request) {

            if (stepToDeep >= reqConfig.redirectDeep) {

                guideBook.markLink(function() {
                    mysql.setStatusForLink(
                        idD, config.codes.requestMaxdeep,
                        function(err, rows) {
                            loggers.file.info('%d MYSQL ROW UPDATED WITH REACH MAX DEEP', idD);

                        }
                    )
                });

                return false;
            }

            reqOpts = request;

        } else {

            // возвращаем значения в исходное положение
            reqOpts = reqOptions;
            reqOpts.hostname = link;
            reqOpts.path = '/';
            reqOpts.port = 80;

            loggers.file.info('%d START %s', idD, link);

        }

        req = makeRequest(reqOpts, function(response) {

            response.setEncoding('utf8');

            var statusCode = response.statusCode + '';
            loggers.file.info('%d REQUEST STATUS : %s', idD, statusCode);
            if (isBadStatusCode(statusCode)) {

                guideBook.markLink(function() {
                    // коды 400 и 500, закрываем лавочку
                    mysql.setStatusForLink(idD, statusCode,
                        function(err, rows) {
                            if (err) loggers.console.error(err);
                            loggers.file.info('%d MYSQL ROW UPDATED WITH BAD STATUS', idD);
                        }
                    );
                });

                return false;
            }

            if (statusCode.indexOf('3') == 0) {

                terminateRequest(req);
                return redirect(response, guideBook);
            }

            if (isBadStatusCode(guideBook.getLinkData().statusCode + '')) {
                // проверяем какой код был у этой ссылки
                mysql.setLinkRecovered(idD, statusCode, function(err, rows) {
                    if (err) loggers.console.error(err);
                    loggers.file.info('%d MYSQL ROW UPDATED WITH RECOVERY STATUS', idD);
                });
            }

            response.setTimeout(
                reqConfig.timeoutInMS,
                function(err) {
                    loggers.file.info('%d HTTP LONG RESPONSE (more %d msec)', idD, reqConfig.timeoutInMS);

                    guideBook.markLink(function(){
                        mysql.setStatusForLink(idD, config.codes.requestTimeout,
                            function(err, rows) {
                                if (err) loggers.console.error(err);
                                loggers.file.info('%d MYSQL ROW UPDATED WITH HTTP LONG RESPONSE', idD);
                            }
                        );
                    });
                }
            );

            modelCallback(response, guideBook);
            return false;

        }).on('error', function(e) {

                // If any error is encountered during the request (be that with DNS resolution, TCP level errors, or
                // actual HTTP parse errors) an 'error' event is emitted on the returned request object.
                // @link http://nodejs.org/api/http.html#http_http_request_options_callback

                loggers.file.warn('%d PROBLEM WITH REQUEST : %s ', guideBook.getIdD(), e.message, reqOpts);
                guideBook.markLink(function() {
                    mysql.setStatusForLink(idD, config.codes.requestAbbruptly, function(err, rows) {
                        if (err) loggers.console.error(err);
                        loggers.file.info('%d MYSQL ROW UPDATED WITH ABRUPT HTTP ERROR', idD);
                    });
                });

                terminateRequest(req);

            });


        req.setTimeout(
            reqConfig.timeoutInMS,
            function() {

                loggers.file.info('%d HTTP LONG REQUEST (more %d msec)', idD, reqConfig.timeoutInMS);

                guideBook.markLink(function(){
                    mysql.setStatusForLink(idD, config.codes.requestTimeout,
                        function(err, rows) {
                            if (err) loggers.console.error(err);
                            loggers.file.info('%d MYSQL ROW UPDATED WITH HTTP LONG RESPONSE', idD);
                        }
                    );
                });

                terminateRequest(req);

            }
        );

        req.end();

        return false;
    }

}

exports.manager = requestsManager;