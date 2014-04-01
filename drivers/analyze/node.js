
var EventEmitter = require('events').EventEmitter;
var util         = require('util');
var net          = require('net');

/**
 * Предполагается, что сервер ожидает 2 текста
 * Первый, он же "новый", будет проверяться на наличие
 * плохих слов, а после, если плохих слов не обнаружено, будет
 * сверяться со вторым, "предыдущим" текстом
 *
 * Имеет 2 события: complete & error
 * complete - анализ выполнен, в кэлбек передается объект
 * @see analyzer-node/worker.js
 *
 * error - произошла ошибка в процессе анализа текста, в кэлбек передается
 * {string} - текст с описанием ошибки и/или ее причин.
 *
 * Created by dezzpil on 24.03.14.
 */
function analyzeNodeDriver(options) {

    EventEmitter.call(this);

    var logger = options.logger,
        config = options.config.analyzer,
        data = { first: null, second: null },
        self = this;

    function write() {

        if (data.first == null || data.second == null) {
            return ;
        }

        var socket = net.createConnection(config.port, config.host, function() {

            // передать данные на сервер с небольшой задержкой
            // ведь иногда 2 буфера по какой-то причине
            // прибывают на сервер как один (слипшись)

            socket.write(data.first, 'utf8');
            for (var i = 0; i < 1000; i++) {}
            socket.write(data.second, 'utf8');

        });

        socket.setEncoding('utf8');
        socket.setTimeout(config.waitForConnection, function() {
            self.emit('error', 'CONNECTION TIMEOUT');
            socket.end();
        });

        socket.on('data', function(result) {
            result = JSON.parse(result);
            self.emit('complete', result);
            socket.end();
        });

        socket.on('error', function(err) {
            self.emit('error', err);
            socket.end();
        });
    }

    /**
     * Передать "новый" текст для анализа,
     * который будет проверен на наличие плохих слов
     * @param text
     */
    this.setNewText = function(text) {
        data.first = text;
        write();
    };

    /**
     * Передать "предыдущий" текст для анализа,
     * с которым будет сравниваться "новый" текст
     * @param text
     */
    this.setPrevText = function(text) {
        data.second = text;
        write();
    };

    /**
     * Получить нулевой результат анализа
     * @param text
     * @returns {{change_percent: number, badword_id: number, badword_context: string}}
     */
    this.getDummyResult = function(text) {
        return {
            'change_percent' : 0,
            'badword_id' : 0,
            'badword_context' : ''
        }
    };

}

util.inherits(analyzeNodeDriver, EventEmitter);
module.exports = analyzeNodeDriver;