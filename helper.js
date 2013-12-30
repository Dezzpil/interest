
/**
 * Created by dezzpil on 09.12.13.
 *
 * Вспомогательный бот для трансформации слепков (impress документы из MongoDB)
 * в простой текст и сохранения этого текста в text документы в MongoDB с
 * дополнительными данными, необходимыми для передачи их в Sphinx через xmlpipe2
 *
 */

var async = require('async'),
    htmlparser = require("htmlparser2"),
    config = require('./configs/config.json')
    loggers = require('./drivers/loggers'),
    fnstore = require('./libs/functionStore'),
    mongo = require('./drivers/mongo'),
    botPID = '1997',
    botLoggers = loggers.forge(botPID);


function ferryHelper() {

    var queue = null,
        urlIdList = [],
        urlIdReadyList = [],
        self = this,
        storage = fnstore.forge();

    mongo.driver.setLoggers(botLoggers).setConfig(config.mongo).connect();

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

    function filter(impress, task, callback) {

        if ( ! impress || impress.length == 0) {
            callback('no impress', task.id);
        } else {
            if (mongo.driver.isContainBadWord(impress[0])) {
                callback('impress contain bad word', task.id);
            } else {
                return true;
            }
        }

        return false;
    }

    function prepareText(text) {
        // TODO spread for optimiations
        // replace html entities to ''

        //var textPrepared = text.replace(/(&.{1,6};)/g, ' ');
        var textPrepared = text;

        // any instances of <, >, & (except for normal element usage) needing to be replaced with
        // &lt;, &gt; and &amp; respectively
        textPrepared = textPrepared.replace(/\</g, '&lt;');
        textPrepared = textPrepared.replace(/\>/g, '&gt;');
        textPrepared = textPrepared.replace(/\&/g, '&amp;');


        // replace many \s to one ' '
        textPrepared = textPrepared.replace(/\s+/g, ' ');

        return textPrepared;
    }

    self.process = function (task, callback) {

        var textInParser = '',
            content,
            parser = null,
            eventFnName = 'ontext';

        // set behavior to mediator
        storage.store('oncode', function(text) {});
        storage.store('ontext', function(text) {
            textInParser += text;
        });

        // response work here
        mongo.driver.getImpress(task.id, function(err, impress) {

            if (filter(impress, task, callback)) {

                var impress = impress[0];

                parser = new htmlparser.Parser({

                    onopentag: function(tagname, attribs) {
                        if (tagname == 'script' || tagname == 'style') eventFnName = 'oncode';
                        else eventFnName = 'ontext';
                    },

                    onclosetag: function(tagname) {
                        if (tagname === "script" || tagname == 'style') eventFnName = 'ontext';
                        // add space after each close tag (then we normalize num of they)
                        textInParser += ' ';
                    },

                    ontext: function(text) {
                        (storage.obtain(eventFnName))(text);
                    },

                    onerror: function(err) {
                        botLoggers.file.warn('htmlparser err', err);
                        callback(impress.url_id);
                    },

                    onend: function() {

                        var text = prepareText(textInParser);
                        botLoggers.file.info('%s text from impress complete (length - %d)', task.id, text.length);

                        mongo.driver.makeTextFromImpress(
                            impress, text, function(err, textDoc) {

                                if (err) {

                                    botLoggers.file.warn('text from impress err', err);
                                    callback(err, impress.url_id);

                                } else {

                                    // work with impresses finally
                                    async.parallel({
                                        'removeExcess' : function(afterReadyFn) {

                                            botLoggers.file.info('%s removing all impress except _id :', task.id, impress._id.toString());
                                            mongo.driver.removeExcessImpresses(impress, function(err) {
                                                if (err) botLoggers.file.error('removing impress excess err', err);
                                                afterReadyFn(err, true);
                                            });

                                        },
                                        'setBatched' : function(afterReadyFn) {

                                            botLoggers.file.info('%s mark impress as batched :', task.id);
                                            mongo.driver.setImpressFerried(impress, function(err) {
                                                if (err) botLoggers.file.error('set impress batch flag err', err);
                                                afterReadyFn(err, true);
                                            });

                                        }},
                                        function(err, results) { // after ready handler

                                            botLoggers.file.info('%s complete', task.id);
                                            callback('text created', impress.url_id);

                                        }
                                    )

                                }

                        });

                    }

                });

                // @todo парсим html в простой текст без тегов.
                botLoggers.file.info(
                    '%s give content from impress to parser (length %d)',
                    impress.url_id, impress.length
                );

                content = impress.content;

                parser.write(content);
                parser.done();

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