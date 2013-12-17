
/**
 * 2013-12-09
 * dezzpil
 * Вспомогательный бот для трансформации слепков (impress документы из MongoDB)
 * в простой текст и сохранения этого текста в text документы в MongoDB с
 * дополнительными данными, необходимыми для передачи их в Sphinx через xmlpipe2
 *
 */

var memwatch = require('memwatch'),
    async = require('async'),
    htmlparser = require("htmlparser2"),
    fs = require('fs'),
    queryString = require('querystring'),
    Buffer = require('buffer').Buffer,
    Iconv  = require('iconv').Iconv,

    configJSON = fs.readFileSync('./configs/config.json'),
    config = JSON.parse(configJSON),

    loggers = require('./drivers/loggers'),
    fnstore = require('./libs/functionStore'),
    mongo = require('./drivers/mongo'),

    // now = new Date(),
    botPID = '1997',
    botLoggers = loggers.forge(botPID);


function ferryHelper() {

    var queue = null,
        urlIdList = [],
        urlIdReadyList = [],
        self = this;

    mongo.driver.setLoggers(botLoggers).connect();

    function initQueue() {

        urlIdReadyList = [];

        botLoggers.file.info('note : queue initialized');

        /**
         * @link 'https://github.com/caolan/async#queueworker-concurrency'
         * @type {*}
         */
        queue = async.queue(function (task, callback) {
            self.process(task, callback);
        }, 2);

        /**
         * @link 'https://github.com/caolan/async#queueworker-concurrency'
         * callback that is called when the last item from the queue has returned from the worker
         */
        queue.drain = function() {
            botLoggers.file.info('note : all items have been started, waiting ...');
            var intervalCount = 0,
                delay = setInterval(function() {

                    if (urlIdReadyList.length == urlIdList.length) {
                        iterate(delay);
                    } else {
                        intervalCount++;
                        if (intervalCount > 6) {
                            iterate(delay);
                        }
                    }

                }, 5000);
        };
    }


    self.process = function (task, callback) {

        var textInParser = '',
            content,
            storage = fnstore.forge(),
            parser = null,
            eventFnName = 'ontext';

        storage.store('ontext', function(text) {
            textInParser += text;
        });

        storage.store('oncode', function(text) {
            //;
        });

        // model work here
        mongo.driver.getImpress(task.id, function(err, impress) {


            if ( ! impress || impress.length == 0) {

                callback('no impress', task.id);

            } else {

                if (mongo.driver.isContainBadWord(impress[0])) {

                    callback('impress contain bad word', task.id);

                } else if (mongo.driver.isBadCharset(impress[0])) {

                    // TODO fix charset problems
                    callback('impress has non utf-8 charset', task.id);

                } else {

                    var impress = impress[0];

                    parser = new htmlparser.Parser({
                        onopentag: function(tagname, attribs) {

                            if (tagname == 'script' || tagname == 'style') {
                                botLoggers.file.info(tagname.toUpperCase() + ' open tag');
                                eventFnName = 'oncode';
                            } else {
                                eventFnName = 'ontext';
                            }

                        },
                        onclosetag: function(tagname){
                            if (tagname === "script" || tagname == 'style') {
                                botLoggers.file.info(tagname.toUpperCase() + ' close tag');
                                eventFnName = 'ontext';
                            }

                            // add space after each close tag (then we normalize num of they)
                            textInParser+=' ';
                        },
                        ontext: function(text) {

                            (storage.obtain(eventFnName))(text);

                        },
                        onerror: function(err) {

                            botLoggers.file.warn('htmlparser err', err);
                            textInParser = '';
                            callback(impress.url_id);

                        },
                        onend: function() {

                            var textFromCurrentHtml = textInParser,
                                iconv, charset = impress.charset;

                            textInParser = '';

                            iconv = new Iconv('UTF-8', charset.toUpperCase());
                            try {
                                textFromCurrentHtml = iconv.convert(textFromCurrentHtml).toString();
                            } catch (e) {
                                callback('charset : ' + charset + ', bad symbols in text ' + e.toString(), impress.url_id);
                                return ;
                            }

                            // TODO optimize OPTIMIZE OPTIMIIIIIIIIZE!
                            // TODO replace with correspond symbols
                            textFromCurrentHtml = textFromCurrentHtml.replace(/(&#{1,6})/g, ' ');

                            // replace html entities to ''
                            textFromCurrentHtml = textFromCurrentHtml.replace(/(&.{1,6};)/g, ' ');

                            // any instances of <, >, & (except for normal element usage) needing to be replaced with
                            // &lt;, &gt; and &amp; respectively
                            textFromCurrentHtml = textFromCurrentHtml.replace(/\</g, '&lt;');
                            textFromCurrentHtml = textFromCurrentHtml.replace(/\>/g, '&gt;');
                            textFromCurrentHtml = textFromCurrentHtml.replace(/\&/g, '&amp;');

                            // replace many \s to one ' '
                            textFromCurrentHtml = textFromCurrentHtml.replace(/\s+/g, ' ');

                            mongo.driver.makeTextFromImpress(
                                impress, textFromCurrentHtml, function(err, text) {

                                    if (err) {
                                        botLoggers.file.warn('text from impress err', err);
                                        callback(err, impress.url_id);
                                    } else {
                                        mongo.driver.setImpressFerried(impress, function(err) {
                                            if (err) {
                                                botLoggers.file.warn('ferrying impress err', err);
                                            }
                                            callback('text created', impress.url_id);
                                        });
                                    }

                            });

                        }

                    });

                    // @todo парсим html в простой текст без тегов.
                    botLoggers.file.info('%s give content from impress to parser (length %d)', impress.url_id, impress.length);

                    content = impress.content;

                    parser.write(content);
                    parser.done();

                }

            }
        });
    };

    function iterate(interval) {
        botLoggers.file.info('note : starting new iteration ...');

        if (interval) clearInterval(interval);

        mongo.driver.getFerryTask(function(error, task) {

            var urlId;

            if (error) {

                botLoggers.file.info('MONGO error (getting ferryTasks) : ', error);
                var interval = setInterval(function() {
                    iterate(interval);
                }, 10000);

            } else {

                if ('url_ids' in task) {
                    botLoggers.file.info(task.url_ids);

                    // save to function scope for checking in interval
                    urlIdList = task.url_ids;
                    urlIdReadyList = [];

                    // add urls id from task to queue
                    // callback for each must be called on link complete !
                    urlId = task.url_ids.shift();
                    initQueue();

                    while(urlId !== undefined) {

                        botLoggers.file.info('note : push to queue item', {id: urlId});

                        queue.push({id: urlId}, function (err, id) {
                            botLoggers.file.info('%s processed', id, err);
                            if (urlIdReadyList.indexOf(id) + 1 == 0) {
                                urlIdReadyList.push(id);
                            }
                        });

                        urlId = task.url_ids.shift();
                    }

                } else {

                    botLoggers.file.info('error : no url_id in ferryTasks', task);

                }

            }

        });
    }

    this.init = function() {
        iterate();
    }
}


(new ferryHelper).init();