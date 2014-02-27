
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

    config = require('./configs/config.json'),
    fnstore = require('./libs/functionStore'),
    mongo = require('./drivers/mongo'),

    loggers = require('./drivers/loggers'),
    loggerProcess = loggers.forge(
        config.loggers.process.type,
        config.loggers.process.options
    ),
    loggerErrors = loggers.forge(
        config.loggers.errors.type,
        config.loggers.errors.options
    );


process.on('uncaughtException', function(err) {
    // silent is golden ?
    loggerErrors.info(err, err.stack);
});

process.on('SIGTERM', function () {

    // Disconnect from cluster master
    process.disconnect && process.disconnect();
    process.exit();

});

//if (process.getgid() === 0) {
//    process.setgid('nobody');
//    process.setuid('nobody');
//}


function ferryHelper() {

    var urlIdList = [], urlIdReadyList = [],
        queue = null, self = this;

    function initQueue() {

        urlIdReadyList = [];
        loggerProcess.info('note : queue initialized');

        queue = async.queue(function (task, callback) {
            self.process(task, callback);
        }, 2);

        /**
         * @link 'https://github.com/caolan/async#queueworker-concurrency'
         * callback that is called when the last item from the queue has returned from the worker
         */
        queue.drain = function() {
            loggerProcess.info('note : all items ready');
            var intervalCount = 0,
                delay = setInterval(function() {

                    if (urlIdReadyList.length == urlIdList.length) {
                        clearInterval(delay);
                        iterate();
                    } else {
                        intervalCount++;
                        if (intervalCount > 6) {
                            clearInterval(delay);
                            iterate();
                        }
                    }

                }, 1000);
        };
    }

    function check_is_empty(impress, task, callback) {

        if ( ! impress || impress.length == 0) {
            callback('no impress', task.id);
            return true;
        }
    }

    function is_with_bad_word(impress, task, callback) {
        if (mongo.driver.isContainBadWord(impress[0])) {
            return true;
        }
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

    /**
     * Work with impresses finally
     * Remove excessed impresses and set last impress as batched
     * @param task
     * @param impress
     */
    function postProcessImpress(task, impress, callback) {

        async.parallel({
                'removeExcess' : function(afterReadyFn) {

                    loggerProcess.info('%s removing all impress except _id :', task.id, impress._id.toString());
                    mongo.driver.removeExcessImpresses(impress, function(err) {
                        if (err) loggerProcess.error('removing impress excess err', err);
                        afterReadyFn(err, true);
                    });

                },
                'setBatched' : function(afterReadyFn) {

                    loggerProcess.info('%s mark impress as batched :', task.id);
                    mongo.driver.setImpressFerried(impress, function(err) {
                        if (err) loggerProcess.error('set impress batch flag err', err);
                        afterReadyFn(err, true);
                    });

                }},
            function(err, results) { // after ready handler

                loggerProcess.info('%s complete', task.id);
                callback('text created', impress.url_id);

            }
        )

    }

    self.process = function (task, callback) {

        var textInParser = '',
            content,
            eventFnName = 'ontext',
            storage = fnstore.forge();

        // set behavior to mediator
        storage.store('oncode', function(text) {});
        storage.store('ontext', function(text) {
            textInParser += text;
        });

        // response work here
        mongo.driver.getImpress(task.id, function(err, impress) {

            if (check_is_empty(impress, task, callback)) {
                return ;
            }

            if (is_with_bad_word(impress, task, callback)) {

                postProcessImpress(task, impress[0], callback);
                return ;

            }

            var impress = impress[0],
                parser = new htmlparser.Parser({

                    onopentag: function(tagname, attribs) {
                        if (tagname == 'script' || tagname == 'style') eventFnName = 'oncode';
                        else eventFnName = 'ontext';
                    },

                    onclosetag: function(tagname) {
                        if (tagname == "script" || tagname == 'style') eventFnName = 'ontext';
                        // add space after each close tag (then we normalize num of they)
                        textInParser += ' ';
                    },

                    ontext: function(text) {
                        (storage.obtain(eventFnName))(text);
                    },

                    onerror: function(err) {
                        loggerProcess.warn('htmlparser err', err);
                        callback(impress.url_id);
                    },

                    onend: function() {

                        var text = prepareText(textInParser);
                        loggerProcess.info('%s text from impress complete (length - %d)', task.id, text.length);

                        mongo.driver.makeTextFromImpress(
                            impress, text, function(err, textDoc) {

                                if (err) {

                                    loggerProcess.warn('text from impress err', err);
                                    callback(err, impress.url_id);

                                } else {

                                    postProcessImpress(task, impress, callback);

                                }

                        });

                    }

                });


            loggerProcess.info(
                '%s give content from impress to parser (length %d)',
                impress.url_id, impress.length
            );

            content = impress.content;

            parser.write(content);
            parser.done();

        });
    };

    //function iterate(interval) {
    function iterate() {
        loggerProcess.info('note : starting new iteration ...');

        //if (interval) clearInterval(interval);

        mongo.driver.getFerryTask(function(error, task) {

            var urlId;

            if (error) {

                //  MONGO error (getting ferryTasks) :  MongoDB : No ferry tasks!
                loggerProcess.info('MONGO error (getting ferryTasks) : ', error);
                var delay = setTimeout(function() {
                    clearTimeout(delay);

                    // while no ferry tasks, lets remove duplicates from impresses
                    // TODO

                    iterate();
                }, 10000);

            } else {

                if ('url_ids' in task) {
                    loggerProcess.info(task.url_ids);

                    // save to function scope for checking in interval
                    urlIdList = task.url_ids;
                    urlIdReadyList = [];

                    // add urls id from task to queue
                    // callback for each must be called on link complete !
                    urlId = task.url_ids.shift();
                    if ( ! urlId) {
                        return iterate();
                    }

                    // init queue
                    initQueue();

                    // and push items to queue
                    while(urlId !== undefined) {

                        loggerProcess.info('note : push to queue item', {id: urlId});

                        queue.push({id: urlId}, function (err, id) {
                            loggerProcess.info('%s processed', id, err);
                            if (urlIdReadyList.indexOf(id) + 1 == 0) {
                                urlIdReadyList.push(id);
                            }
                        });

                        urlId = task.url_ids.shift();
                    }

                } else {

                    loggerProcess.info('error : no url_id in ferryTasks', task);
                    iterate();

                }

            }

        });
    }

    self.init = function() {
        iterate();
    }
}

mongo.driver
    .setConfig(config.mongo)
    .setLogger(loggerProcess)
    .connect(function(err) {

        if (err) throw err;
        (new ferryHelper).init();

    }
);