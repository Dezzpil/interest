
var http           = require('http');
var https          = require('https');
var url            = require('url');
var EventEmitter   = require('events').EventEmitter;
var util           = require('util');

/**
 * TODO написать примеры использования
 * TODO написать описание
 * Created by dezzpil on 29.11.13.
 */
function RequestManager(options) {

    EventEmitter.call(this);

    var self = this,
        logger = options.logger,
        mysql = options.mysql,
        config = options.config,
        stepToDeep = 0,
        requestDefOptions = {
            hostname: '',
            port: 80,
            path: '/',
            method: 'GET',
            headers: {
                'user-agent' : config.request.userAgent,
                'connection' : 'keep-alive'
            }
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

            var reqOpts =  requestDefOptions,
                redirectUrl = url.parse(response.headers.location);

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

    /**
     *
     * @param {Number} statusCode
     * @returns {boolean}
     */
    function isBadStatusCode(statusCode) {
        return statusCode.indexOf('5') == 0
            || statusCode.indexOf('4') == 0
            || statusCode.indexOf('9') == 0;
    }

    /**
     * Получить ответ для гайдбука.
     * Следит за процессами обращения по адресам,
     * пытается получить данные и запускает событие
     * success, если удается получить корректный ответ (200)
     *
     * @param {LinksGuideBook} guideBook
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

            // проверяем текущую глубину редиректа, если
            // она больше, либо равна указанной в конфиге, то
            // закрываем лавочку
            if (stepToDeep >= config.request.redirectDeep) {
                guideBook.markLink(function() {
                    mysql.setStatusForLink(
                        idD, config.codes.requestMaxdeep,
                        function(err, rows) {
                            logger.info('%s MYSQL ROW UPDATED WITH REACH MAX DEEP', idD);
                        }
                    )
                });

                return false;
            }

            reqOpts = request;

        } else {

            // возвращаем значения в исходное положение
            // мержим объекты

            var prop, linkParsed = url.parse(link);

            for (prop in requestDefOptions) {
                reqOpts[prop] = requestDefOptions[prop];
            }

            for (prop in reqOpts) {
                if (prop in linkParsed) {
                    reqOpts[prop] = linkParsed[prop];
                }
            }
        }

        if (request) link = request.hostname + request.path;
        logger.info('%s START %s', idD, link);

        req = makeRequest(reqOpts, function(response) {

            response.setEncoding('binary');

            var statusCode = response.statusCode + '';
            logger.info('%s REQUEST STATUS : %s', idD, statusCode);

            // коды 40Х и 50Х, закрываем лавочку
            if (isBadStatusCode(statusCode)) {
                guideBook.markLink(function() {
                    mysql.setStatusForLink(idD, statusCode,
                        function(err, rows) {
                            if (err) throw err;
                            logger.info('%s MYSQL ROW UPDATED WITH BAD HTTP CODE', idD);
                        }
                    );
                });

                return false;
            }

            // если код 30Х, то закрываем этот запрос и открываем 
            // новый по адресу указанному в заголовках ответа с кодом 30Х
            if (statusCode.indexOf('3') == 0) {

                terminateRequest(req);
                return redirect(response, guideBook);
            }

            // проверяем какой код был у этой ссылки
            if (isBadStatusCode(guideBook.getLinkData().statusCode + '')) {
                mysql.setLinkRecovered(idD, statusCode, function(err, rows) {
                    if (err) throw err;
                    logger.info('%s MYSQL ROW UPDATED WITH RECOVERY STATUS', idD);
                });
            }

            self.emit('response', guideBook, response);

        }).on('error', function(e) {

            // If any error is encountered during the request (be that with DNS resolution, TCP level errors, or
            // actual HTTP parse errors) an 'error' event is emitted on the returned request object.
            // @link http://nodejs.org/api/http.html#http_http_request_options_callback

            logger.info('%s PROBLEM WITH REQUEST : %s ', guideBook.getIdD(), e.message, reqOpts);
            guideBook.markLink(function() {
                mysql.setStatusForLink(idD, config.codes.requestAbbruptly, function(err, rows) {
                    if (err) throw err;
                    logger.info('%s MYSQL ROW UPDATED WITH ABRUPT HTTP ERROR', idD);
                });
            });

            terminateRequest(req);
        });

        req.setTimeout(
            config.request.timeout,
            function() {

                if (guideBook.isMarked()) return ;
                logger.info('%s HTTP LONG REQUEST (more %d msec)', idD, config.request.timeout);
                guideBook.markLink(function(){
                    mysql.setStatusForLink(idD, config.codes.requestTimeout,
                        function(err, rows) {
                            if (err) throw err;
                            logger.info('%s MYSQL ROW UPDATED WITH HTTP LONG RESPONSE', idD);
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

util.inherits(RequestManager, EventEmitter);
module.exports = RequestManager;