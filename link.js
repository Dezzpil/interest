
var util         = require("util");
var EventEmitter = require('events').EventEmitter;
var async        = require('async');

/**
 * Менеджер ссылок.
 * Следит за общим ходом процесса, запрашивает
 * новые адреса для новой итерации проверки.
 *
 * Created by dezzpil on 29.11.13.
 *
 * Имеет 4 события: empty & start & end & terminated
 * @event start - старт итерации по гиду
 * @event end - корректное завершнеие итерации (все гайдбуки помечены)
 * Это штатные события, возникающие при нормальном ходе работы менеджера.
 * Старт возникает в начале итерации, а енд в конце, при условии,
 * что все гайдбуки помеченны как посещенные (guidebook.markLink())
 *
 * @event empty возникает в ситуации, когда не указан гид, с которым может работать
 * менеджер ссылок. empty ничего не передает в колбэк.
 *
 * @event terminated возникает в ситуации, когда время ожидания ответа всех ссылок
 * после начала итерации истекло
 *
 * @param {object} options
 * @param {function} callback
 */
function LinksManager(options, callback) {

    EventEmitter.call(this);

    this.logger = options.logger;
    this.config = options.config;

    if ( ! this.config) throw new Error('LinksManager : no logger config!');
    if ( ! this.logger) throw new Error('LinksManager : no logger setted!');
    if ( ! callback) throw new Error('LinksManager : no callback setted!');

    // определяем механизм работы обработчика для очереди
    // обработки путеводителя, запуск очереди происходит позже

    this.queue = async.queue(
        function (guidebook, afterReady) {
            guidebook.setQueueCallback(afterReady);
            callback(guidebook);
        },
        this.config.iteration.yields
    );

}

util.inherits(LinksManager, EventEmitter);
LinksManager.prototype.run = function(guide) {

    var self = this,
        config = this.config,
        logger = this.logger,
        queue = this.queue;

    if ( ! guide) {
        return self.emit('empty', null);
    }

    if ( ! guide.isEmpty()) {

        self.emit('start', guide);

        while ( ! guide.isEmpty()) {

            var guidebook = guide.getGuideBook();

            queue.push(guidebook, function(err) {
                if (err) throw err;
            });
            guide.next();
        }

        self.run(guide);

        return true;

    } else {

        // Гид запустил процессы по всем адресам, что мы ему указали,
        // и хочет попить пивка с друзьями в баре Heap'е пока не настал gc(),
        // когда ему придется возвратиться к жене и детям...

        // А мы будем ждать пока все процессы освободяться, чтобы отправить их по
        // новым адресам с новым гидом :)

        var count = 0,
            interval = setInterval(function() {

                count++;

                if (count >= config.iteration.recheckCount) {
                    clearInterval(interval);
                    self.emit('terminate', guide);
                }

                if (guide.getList().length <= guide.getReadyList().length) {

                    clearInterval(interval);
                    self.emit('end', guide);

                    var delay = setTimeout(function() {
                        clearTimeout(delay);
                        self.run();
                    }, config.iteration.restartDelay);

                }

            }, config.iteration.recheckDelay);

    }

    return false;

}

module.exports = LinksManager;