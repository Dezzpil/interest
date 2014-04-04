
var EventEmitter   = require('events').EventEmitter;
var util           = require('util');
var exec           = require('child_process').exec;

/**
 * Модель обработки ответа. Сбора и обработки тела ответа.
 * Сбор и обработка заключается в получении полного ответа,
 * определении его кодировки и перекодировании в utf8.
 *
 * В случае ошибки на любом из этапов - модель
 * завершает обработку гайдбука (с помощью guidebook.markLink())
 * и через драйвер для domainStorage (mysql) помечает соответ. строку с
 * использованием следующих кодов (секция codes в конфиге) :
 *
 * requestAbbruptly - подключание внезапно оборвалось
 * requestEmpty     - пустое тело ответа
 * errorWhenChardet - возникла ошибка при определении кодировки тела ответа
 * errorWhenEncode  - возникла ошибка при декодировании тела ответа
 *
 * Имеет 3 события: received & detected & recoded
 * Каждое из событий передает в колбек guidebook и строку
 *
 * @event received передает guidebook, bodyHTML
 * @event detected передает guidebook, charset
 * @event recoded передает guidebook, stdout
 *
 * @param {object} options
 * Created by dezzpil on 18.11.13.
 */
function ResponseManager(options) {

    EventEmitter.call(this);
    
    var self = this,
        logger = options.logger,
        mysql = options.mysql,
        config = options.config;

    /**
     * Catch error on exec some library and 
     * save data in mysql for link with error
     * @param {Object} err
     * @param {String} stderr
     * @param {Number} code
     * @returns {boolean}
     */
    function catchExecErrors(guidebook, err, stderr, code) {

        if (err || stderr) {

            guidebook.markLink(function() {
                mysql.setStatusForLink(
                    guidebook, code,
                    function(err, rows) {
                        logger.info('%s MYSQL ROW UPDATED WITH EXEC ERROR', guidebook.getIdD(), (err || stderr));
                    }
                );
            });

            return true;
        }

        return false;
    }

    function process(guidebook, bodyHTML) {

        var execOptions, chardetector;

        execOptions = {
            encoding : 'binary',
            timeout: config.encode.timeout * 1000,
            maxBuffer: config.encode.maxBufferInKb * 1024,
            killSignal: config.encode.killSignal,
            cwd: config.encode.cwd,
            env: config.encode.env
        };

        // start character detection
        chardetector = exec(
            config.path + config.encode.detectionName,
            execOptions,
            function(err, stdout, stderr) {

                if (catchExecErrors(guidebook, err, stderr,
                    config.codes.errorWhenChardet)) return ;

                var recoder,
                    charset = stdout.match(/:(.*)\(/)[1].trim().toLowerCase();

                switch (charset) {
                    // remarks for charset names
                    case 'koi8-r' : charset = 'koi8-ru';
                        break;
                }

                self.emit('detected', guidebook, charset);

                recoder = exec(
                    config.encode.recodeName + ' ' + charset + '..utf-8',
                    execOptions,
                    function(err, stdout, stderr) {

                        if (catchExecErrors(guidebook, err, stderr,
                            config.codes.errorWhenEncode)) return ;

                        self.emit('recoded', guidebook, stdout);
                    }
                );

                // pull data to chosen encoder
                recoder.stdout.setEncoding('utf8');
                recoder.stdin.end(bodyHTML, 'binary');

            }
        );

        // pull data to chosen character detector
        chardetector.stdin.end(bodyHTML, 'binary');
    }

    /**
     * Init common logic for response on link
     * @param {http.ServerResponse} Response
     * @param {LinksGuideBook} guidebook
     * @returns {boolean}
     */
    this.run = function(Response, Guidebook) {

        var guidebook = Guidebook,
            response = Response,
            idD = guidebook.getIdD(),
            responseBody = '';

        response.setTimeout(
            config.response.timeout,
            function(err) {
                if (guidebook.isMarked()) return ;
                logger.info('%s HTTP LONG RESPONSE (more %d msec)', idD, config.response.timeout);
                guidebook.markLink(function(){
                    mysql.setStatusForLink(guidebook, config.codes.requestTimeout,
                        function(err, rows) {
                            if (err) throw err;
                            logger.info('%s MYSQL ROW UPDATED WITH HTTP LONG RESPONSE', idD);
                        }
                    );
                });
            }
        );

        response.on('data', function (content) {

            responseBody += content;

        }).on('end', function() {

            if ( ! responseBody || ! responseBody.length) {
                return guidebook.markLink(function() {
                    mysql.setStatusForLink(guidebook, config.codes.requestEmpty, function(err, rows) {
                        logger.info('%s MYSQL ROW UPDATED WITH EMPTY RESPONSE', idD);
                    });
                });
            }

            logger.info('%s CONTENT RECEIVED, %d length', idD, responseBody.length);
            self.emit('received', guidebook, responseBody, process);

            //process(guidebook, responseBody);

        }).on('error', function(err) {

            logger.info('%s HTTP ', idD, err);
            guidebook.markLink(function() {
                mysql.setStatusForLink(guidebook, config.codes.requestAbbruptly,
                    function(err, rows) {
                        if (err) logger.console.error(err);
                        logger.info('%s MYSQL ROW UPDATED WITH HTTP ERROR', idD);
                    }
                );
            });


        });
    }
}

util.inherits(ResponseManager, EventEmitter);
module.exports = ResponseManager;