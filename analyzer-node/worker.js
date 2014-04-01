
var EventEmitter   = require('events').EventEmitter;
var util           = require('util');
var ld             = require('ld');

/**
 * Имеет 2 события: complete & error
 * complete - анализ выполнен, в кэлбек передается объект вида:
 * { change_percent: Number, badword_id: Number, badword_context: String }
 *
 * error - произошла ошибка в процессе анализа текста, в кэлбек передается
 * {string} - текст с описанием ошибки и/или ее причин.
 *
 * На данный момент текст сравнивается с использованием расстояния Левенштейна
 * @see http://ru.wikipedia.org/wiki/%D0%A0%D0%B0%D1%81%D1%81%D1%82%D0%BE%D1%8F%D0%BD%D0%B8%D0%B5_%D0%9B%D0%B5%D0%B2%D0%B5%D0%BD%D1%88%D1%82%D0%B5%D0%B9%D0%BD%D0%B0
 *
 * @param {Object} options
 *
 * Created by dezzpil on 27.03.14.
 */
function analyzeWorker(options) {

    EventEmitter.call(this);

    /**
     * Предполагается, что 1-ый элемент в массиве - новый текст,
     * а 2-ой предыдущий текст
     *
     * Сначала новый текст проверяется на наличие плохих слов, если они
     * найдены, дальнейшей проверки не будет - наступает событие complete
     *
     * Если плохих слов в новом тексте нет, то происходит сравнение нового
     * текста со старым, после которого наступает событие complete
     *
     * для события complete в кэлбек передается объект вида:
     * { change_percent: Number, badword_id: Number, badword_context: String }
     *
     * @param {array} data Массив строк
     */
    this.work = function(data) {

        // сначала проверим наличие плохих слов в первом тексте
        var newText, newTextWords, oldText,
            i, j, word, badword_context = '', badword_id = 0,
            distance = 0;

        newText = data[0].toLowerCase().replace(/\s/g, ' ');
        newTextWords = newText.split(' ');

        for (i in newTextWords) {
            word = newTextWords[i];
            if (word in options.badwordslist) {
                badword_id = options.badwordslist[word].id;
                for (j = i - 2; j >= i + 2; j++) {
                    try {
                        badword_context += newTextWords[j]
                    } catch (e) {
                        // no such index
                    }
                }

                this.emit('complete', {
                    badword_context: badword_context,
                    badword_id: badword_id,
                    change_percent: 0
                });

                return ;
            }
        }

        oldText = data[1].toLowerCase().replace(/\s/g,' ');

        // текст может быть дописан или, вообще, переписан заново
        // попарное сравнение слов разумно только для массивов одинаковой длины, но
        // в массивах одинаковой длины могут быть просто переставлены слова.
        // какой метод лучше подходит для определения процента изменений
        // на данный момент несущественно, тут надо TODO продумать механизм сравнения 2 текстов
        // пока используем сравнение с использованием расстояния Левенштейна
        distance = ld.computeDistance(oldText, newText);
        distance = Math.floor(distance / oldText.length * 100);

        this.emit('complete', {
            badword_context: '',
            badword_id: 0,
            change_percent: distance
        });

    }

}

util.inherits(analyzeWorker, EventEmitter);
module.exports = analyzeWorker;