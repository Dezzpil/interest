
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
 * @event exec_error передает guidebook, {error}
 * @event con_error передает guidebook, {error}
 * @event con_timeout передает guidebook
 * @event empty передает guidebook
 *
 * @param {object} options
 * Created by dezzpil on 18.11.13.
 */
function ResponseManager(options) {

    EventEmitter.call(this);
    
    var self = this,
        logger = options.logger,
        config = options.config;

    /**
     * Catch error on exec some library and 
     * save data in mysql for link with error
     * @param {Object} err
     * @param {String} stderr
     * @param {Number} code
     * @returns {boolean}
     */
    function catchExecErrors(guidebook, err, stderr) {

        var error = null;
        if (err || stderr) {

            if (err) error = err;
            else if (stderr) error = new Error(stderr);

            self.emit('exec_error', guidebook.markLink(), error);
            return true;
        }

        return false;
    }

    /**
     * Обработать тело ответа (определить кодировку и декодировать в utf8)
     * @param guidebook
     * @param bodyHTML
     */
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

                if (catchExecErrors(guidebook, err, stderr)) return ;

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

                        if (catchExecErrors(guidebook, err, stderr)) return ;

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
                self.emit('con_timeout', guidebook.markLink());
            }
        );

        response.on('data', function (content) {

            responseBody += content;

        }).on('end', function() {

            if ( ! responseBody || ! responseBody.length) {
                self.emit('empty', guidebook.markLink());
            }

            logger.info('%s CONTENT RECEIVED, %d length', idD, responseBody.length);
            self.emit('received', guidebook, responseBody, process);

        }).on('error', function(err) {

            self.emit('con_error', guidebook.markLink(), err);

        });
    }
}

util.inherits(ResponseManager, EventEmitter);
module.exports = ResponseManager;