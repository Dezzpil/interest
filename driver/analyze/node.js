
var EventEmitter = require('events').EventEmitter;
var util         = require('util');
var net          = require('net');

/**
 * Предполагается, что сервер ожидает 2 текста
 * Первый, он же "новый", будет проверяться на наличие
 * плохих слов, а после, если плохих слов не обнаружено, будет
 * сверяться со вторым, "предыдущим" текстом
 *
 * Важно! События можно не обрабатывать, главный метод
 * с которым необходимо вести всю работу - это run().
 * callback, передающийся в run() вызывается при любом ответе сервера и даже
 * при тайм-ауте соединения. При ошибке в callback вторым параметром передается
 * описание ошибки.
 *
 * Имеет 2 события: complete & error
 * @event complete - анализ выполнен, в кэлбек передается объект
 * @see analyzer-node/worker.js
 *
 * @event error - произошла ошибка в процессе анализа текста, в кэлбек передается
 * объект c пустым ответом и ошибка
 *
 * Created by dezzpil on 24.03.14.
 */
function AnalyzeNodeDriver(options) {

    EventEmitter.call(this);

    var logger = options.logger,
        config = options.config.analyzer,
        self = this;

    /**
     * Получить нулевой результат анализа
     * @param text
     * @returns {{change_percent: number, badword_id: number, badword_context: string}}
     */
    function getDummyResult() {
        return {
            'change_percent' : 0,
            'badword_id' : 0,
            'badword_context' : ''
        }
    };

    self.getDummyResult = function() {
        return getDummyResult();
    }

    /**
     * Разбить текст на части и вернуть список частей
     *
     * Рекурсивно это приводит к RangeError: Maximum call stack size exceeded
     * поэтому написано итерактивно
     *
     * @param {String} text
     * @param {Number} length
     * @returns {*}
     */
    function chunk(text, length) {

        var part, chunks = [], slicedText = text;

        while (slicedText != '') {
            part = slicedText.slice(0, length);
            chunks.push(part);
            slicedText = slicedText.slice(length, text.length);
        }

        chunks.push(config.chunkGlue);

        return chunks;
    }

    /**
     * Асинхронно передать на сервер данные по частям
     * @param socket
     * @param {Array} chunkedText
     * @param {Function} callback Optional
     */
    function sendChunks(socket, chunkedText, callback) {

        var delay = setInterval(function() {

            var chunk = chunkedText.shift();
            socket.write(chunk, 'utf-8', function() {
                if (chunk == config.chunkGlue) {
                    clearInterval(delay);
                    if (callback) callback();
                }
            });

        }, 100);
    }

    function send(firstText, secondText, callback) {

        var firstTextChunked = [],
            secondTextChunked = [],
            socket = null;

        socket = net.createConnection(config.port, config.host, function() {

            // передать данные на сервер с небольшой задержкой
            // ведь иногда 2 буфера по какой-то причине
            // прибывают на сервер как один (слипшись)
            sendChunks(socket, firstTextChunked, function() {
                sendChunks(socket, secondTextChunked);
            });

            socket.on('drain', function() {

            })

            socket.on('error', function(err) {
                try {
                    socket.end();
                } catch (e) {

                }
                self.emit('error', err.toString());
            })

        });

        firstTextChunked = chunk(firstText, config.chunkLength);
        secondTextChunked = chunk(secondText, config.chunkLength);

        socket.setNoDelay(true);
        socket.setEncoding('utf8');
        socket.setTimeout(config.waitForAnswer, function() {
            socket.end();
            self.emit('error', 'CONNECTION TIMEOUT');
        });

        socket.on('data', function(result) {
            socket.end();
            result = JSON.parse(result);
            callback(result);
        });

        socket.on('error', function(err) {
            socket.end();
            callback(getDummyResult(), err);
        });
    }



    this.run = function(newText, prevText, callback) {

        newText = newText ? newText : '';
        prevText = prevText ? prevText : '';

        if (newText == '' && prevText == '') {
            callback(getDummyResult()); return;
        } else if (newText == '' && prevText != '') {
            newText = prevText;
        } else {
            prevText = newText;
        }

        send(newText.toLowerCase(), prevText.toLowerCase(), callback);
        return ;
    };

}

util.inherits(AnalyzeNodeDriver, EventEmitter);
module.exports = AnalyzeNodeDriver;