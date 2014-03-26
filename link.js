/**
 * Created by dezzpil on 29.11.13.
 */
var util         = require("util");
var EventEmitter = require('events').EventEmitter;
var async        = require('async');

/**
 * Менеджер ссылок.
 * Следит за общим ходом процесса, запрашивает
 * новые адреса для новой итерации проверки.
 *
 * @todo дописать примеры использования
 * @param {object} options
 * @param {function} callback
 */
function LinksManager(options, callback) {

    EventEmitter.call(this);

    this.logger = options.logger;
    this.config = options.config;
    this.linkBroken = 0;
    this.callback = callback;

    if ( ! this.config) throw new Error('LinksManager : no logger config!');
    if ( ! this.logger) throw new Error('LinksManager : no logger setted!');
    if ( ! this.callback) throw new Error('LinksManager : no callback setted!');

    // определяем механизм работы обработчика для очереди
    // обработки путеводителя, запуск очереди происходит позже

    this.queue = async.queue(
        function (guidebook, afterReady) {
            guidebook.setQueueCallback(afterReady);
            callback(guidebook);
        },
        this.config.maxYields
    );

}

util.inherits(LinksManager, EventEmitter);
LinksManager.prototype.run = function(guide) {

    var self = this,
        config = this.config,
        logger = this.logger,
        queue = this.queue;

    if ( ! guide) {

        self.emit('start', null);
        return false;
    }

    if ( ! guide.isEmpty()) {

        // Упреждающая проверка адресов на корректность.
        // На те случаи, когда адреса кончились или
        // состоят из пробелов. Тут можно @todo проверять на корректность адресных имен

        /**
         * Самая сложная часть для понимания, имхо, в этом куске кода.
         * Чтобы реализовать асинхронный процесс прохода по ссылкам, полученным из БД
         * необходимо отказаться от циклов и использовать рекурсию. readLinkList вызывает
         * сам себя с небольшим интервалом времени после вызова модели. Функция реализующая
         * модель возвращает ответ очень быстро, так как, все что она делает - инициирует
         * запрос на переданный из контроллера адрес. Все остальное происходит асинхронно
         * и делается по мере возникновения соотв. событий :
         *  - когда приходит заголовки ответа
         *  - когда приходит тело ответа
         *  - когда приходят ответы от баз данных
         *  - когда приходит ответ анализатора
         *
         *  Чтобы контроллер был самодостаточен, и понятна логика происходящего,
         *  рекурсивный вызов контроллера должен помещаться в самом контроллере и происходить
         *  с некоторой задержкой
         */

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

                if (
                    config.readyCheckMaxTryCount <= count ||
                        guide.getList().length <= (guide.getReadyList().length + self.linkBroken)
                    ) {

                    clearInterval(interval);
                    self.linkBroken = 0;

                    //invokeHooks('end', guide);
                    self.emit('end', guide);

                    var delay = setTimeout(function() {
                        clearTimeout(delay);
                        self.run();
                    }, config.eachIterationDelay);

                }

            }, config.readyCheckPeriodInSec * 1000);

    }

    return false;

}

module.exports = LinksManager;