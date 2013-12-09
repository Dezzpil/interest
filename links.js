/**
 * Created by dezzpil on 29.11.13.
 */
var LinkGuide = require('./linkGuide'),
    async = require('async');

/**
 * Контроллер работ,
 * следит за общим ходом процесса, запрашивает
 * новые адреса для новой итерации проверки
 */
function linksManager() {

    var loggers = null,
        botPID = null,
        mysql = null,
        self = this,
        intervalCount = 25,
        intervalPeriod = 1000,
        linkBrokenProcs = 0,
        callback = null,
        callbackOnIterateStart = null,
        callbackOnIterateFin = null,
        queue = null,
        isTerminated = false,
        config;

    this.setOptions = function(opts) {
        config = opts;
        return self;
    };

    this.setLoggers = function(object) {
        loggers = object;
        return self;
    };

    this.setMysqlDriver = function(driver) {
        mysql = driver;
        return self;
    };

    this.setBotPID = function(pid) {
        botPID = pid;
        return self;
    };

    this.setRequestManager = function(fn) {
        callback = fn;
        return self;
    };

    this.increaseBrokenCount = function() {
        linkBrokenProcs++;
        return linkBrokenProcs;
    };

    this.resetBrokenCount = function() {
        linkBrokenProcs = 0;
        return linkBrokenProcs;
    };

    this.setOnIterateStart = function(fn) {
        callbackOnIterateStart = fn;
        return self;
    };

    this.setOnIterateFin = function(fn) {
        callbackOnIterateFin = fn;
        return self;
    };

    this.stop = function() {
        isTerminated = true;
    };

    /**
     * Запустить контроллер ссылок
     * @param callback
     * @param guide
     * @returns {boolean}
     */
    this.run = function(guide) {

        if (isTerminated) return false;

        if ( ! loggers) throw new Error('readLinkList : no loggers list setted!');
        if ( ! mysql) throw new Error('readLinkList : no mysql driver setted!');
        if ( ! botPID) throw new Error('readLinkList : no botPID setted!');
        if ( ! callback) throw new Error('readLinkList : no callback setted!');

        if ( ! guide) {

            // Инициализация, если гид не указан.
            // Получаем список адресов, создаем гида для их обхода,
            // и вызываем сами себя, но уже с гидом
            mysql.links(botPID, function(rows) {

                var guide = LinkGuide.forge(rows, loggers);
                //loggers.file.info(guide.getList());
                if (callbackOnIterateStart) callbackOnIterateStart();

                queue = async.queue(function (guidebook, afterReady) {
                    loggers.console.info('start %s', guidebook.getDomain());
                    guidebook.setCallback(afterReady);
                    callback(guidebook);
                }, config.maxYields);

                queue.drain = function() {
                    loggers.console.info('all items have been processed');
                };

                self.run(guide);

            });

            return false;
        }


        if (!guide.isEmpty()) {

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

            //guide.next();
            while (!guide.isEmpty()) {

                var gb = (new guide.getGuideBook());
                queue.push(gb, function(err) {
                    if (err) loggers.console.error(err);
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

                    loggers.console.info(
                        'complete %d ( + %d exceptions) from %d',
                        guide.getReadyList().length,
                        linkBrokenProcs,
                        guide.getList().length
                    );

                    if (
                        intervalCount <= count ||
                        guide.getList().length <= (guide.getReadyList().length + linkBrokenProcs)
                    ) {

                        clearInterval(interval);
                        self.resetBrokenCount();

                        mysql.clearLinks(botPID, function() {});

                        if (callbackOnIterateFin) callbackOnIterateFin(guide);

                        var delay = setTimeout(function() {
                            clearTimeout(delay);
                            self.run();
                        }, config.eachIterationDelay);

                    }

                }, intervalPeriod);

        }

        return false;

    }
}

exports.manager = linksManager;