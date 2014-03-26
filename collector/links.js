/**
 * Created by root on 26.03.14.
 */

var EventEmitter   = require('events').EventEmitter;
var util           = require('util');
var url            = require('url');
var htmlparser2    = require("htmlparser2");

function LinksCollector(options) {

    EventEmitter.call(this);

    this.guidebook = null;
    this.config = options.config;
    this.linksMap = {};

    /**
     * Установить активный гайдбук
     * @param {LinksGuideBook} guideBook
     */
    this.setGuideBook = function(guideBook) {
        this.guidebook = guideBook
    };

}

util.inherits(LinksCollector, EventEmitter);
LinksCollector.prototype.parseHTML = function(html) {

    var self = this, currentId;

    if (self.guidebook == null) {
        self.emit('error', new Error('no guidebook setted'));
        return;
    }

    currentId = self.guidebook.getIdD() + '';

    if (currentId.split(':').length - 1 >= self.config.crawler.deep) {
        self.emit('collected', null);
        return;
    }

    // парсим тело ответа и сохраняем ссылки на внутренние
    // страницы сайта, добавляем их в путеводитель
    var parser, links = [],
        ignore_list = self.config.crawler.ignore,
        ignore_regexp = new RegExp("^\/$" + ignore_list.replace(/\|/g,"|\\.") + "|^#$|^#.{1,}$");

    parser = new htmlparser2.Parser({
        onopentag : function(name, attrs) {

            if (name != 'a') return;

            if (! ('href' in attrs)) return;

            if ('rel' in attrs && attrs.rel == 'nofollow' && self.config.crawler.perceive_nofollow) {
                return;
            }

            if (attrs.href.match(ignore_regexp) == null) {

                // избавляем текущую ссылку от ненужных частей
                var currentDomain = self.guidebook.getDomain();
                if (self.guidebook.getDomain().match(/^(?:http|https):\/\/(.+)/) != null) {
                    currentDomain = url.parse(self.guidebook.getDomain()).hostname;
                }

                // иногда ссылки на странице указаны абсолютно
                if (attrs.href.match(/^(?:http|https):\/\/(.+)/) != null) {

                    // и иногда это ссылки на внешние ресурсы, которые нас не интересуют
                    if (url.parse(attrs.href).hostname != currentDomain) {
                        return;
                    }
                } else {
                    attrs.href = currentDomain + attrs.href;
                }

                // если ссылка еще не встречалась, мы сохраняем ее в список
                // и в индекс, чтобы в дальнейшем ее не проходить
                if (!(attrs.href in self.linksMap)) {
                    links.push(attrs.href);
                    self.linksMap[attrs.href] = true;
                }
            }

            /**
             * @todo добавить проверку значений robots.txt, отдельная задача
             */
        },
        'onend' : function() {

            self.emit('collected', links);

        },
        'onerror' : function(err) {

            self.emit('error', err);

        }
    });

    parser.write(html);
    parser.end();
}

module.exports = LinksCollector;