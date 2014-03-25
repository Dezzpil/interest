/**
 * Created by dezzpil on 29.11.13.
 */

async = require('async');


/**
 * Менеджер ссылок.
 * Следит за общим ходом процесса, запрашивает
 * новые адреса для новой итерации проверки.
 *
 * @todo дописать примеры использования
 * @param {object} options
 * @param {function} callback
 */
function linkManager(options, callback) {

    var logger = options.logger,
        config = options.config,
        self = this,
        hooks = { 'start' : null, 'end' : null },
        queue = [],
        linkBrokenProcs = 0;

    /**
     * Установить обработчики для событий. [start, end]
     * @param {string} eventName
     * @param {function} callback
     * @returns {linkManager}
     */
    self.on = function(eventName, callback) {
        hooks[eventName] = callback;
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

    /**
     * Запустить контроллер ссылок
     * @param {LinkGuide} guide
     * @returns {boolean}
     */
    this.run = function(guide) {

        if ( ! logger) throw new Error('linkManager : no logger setted!');
        if ( ! mysql) throw new Error('linkManager : no mysql driver setted!');
        if ( ! botPID) throw new Error('linkManager : no botPID setted!');
        if ( ! callback) throw new Error('linkManager : no callback setted!');

        if ( ! guide) {

            // определяем механизм работы обработчика для очереди
            // обработки путеводителя, запуск очереди происходит позже
            queue = async.queue(
                function (guidebook, afterReady) {
                    guidebook.setQueueCallback(afterReady);
                    callback(guidebook);
                },
                config.maxYields
            );

            invokeHooks('start', null);
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
                        guide.getList().length <= (guide.getReadyList().length + linkBrokenProcs)
                    ) {

                        clearInterval(interval);
                        self.resetBrokenCount();

                        invokeHooks('end', guide);

                        var delay = setTimeout(function() {
                            clearTimeout(delay);
                            self.run();
                        }, config.eachIterationDelay);

                    }

                }, config.readyCheckPeriodInSec * 1000);

        }

        return false;

    }

    this.resetBrokenCount = function() {
        linkBrokenProcs = 0;
        return linkBrokenProcs;
    };
}

exports.manager = linkManager;