/**
 * Created by root on 26.03.14.
 */

var EventEmitter   = require('events').EventEmitter;
var util           = require('util');
var url            = require('url');
var htmlparser2    = require("htmlparser2");

/**
 * Умеет собирать уникальные значения атрибута href у тегов <a />
 * определять какие из них ведут на отличные от текущей страницы
 * внутри сайта.
 *
 * Фильтрует :
 *  внешние адреса
 *  ссылки протоколов, отличных от http & https
 *  и якоря
 *
 * Имеет 2 события: collected & error
 * @event collected возвращает guidebook, {Array}
 * @event error возвращает guidebook, {Object}
 *

  linksCollector = new LinksCollector({ config : a });
  linksCollector.on('collected', function(links) {
        // делаем что-то полезное со массивом ссылок
  });

  responseManager.on('recoded', function(guidebook, html) {
       linksCollector.parseHTML(guidebook, html);
  });

  // надо пересоздать коллектора, ибо каждый коллектор
  // накапливает cacheMap, в котором хранит индекс уже найденных
  // ссылок. Нельзя, чтобы индекс разрастался на протяжении всей работы бота,
  // потому что в нем лежат данные об уже пройденных сайтах
  linkManager.on('empty', function() {
       linksCollector = new LinksCollector({ config : a });
  });

 * @param {Object} options
 * @constructor
 */
function LinksCollector(options) {

    EventEmitter.call(this);

    this.config = options.config;
    this.addHostname = ('addHostname' in options) ? options.addHostname : true;
    this.cacheMap = {};

    /**
     * Очистить кэш ссылок
     */
    this.clearCache = function() {
        this.cacheMap = {};
    }
}

util.inherits(LinksCollector, EventEmitter);

/**
 * Вызывает события collected || error
 * @param {LinksGuideBook} guidebook
 * @param {String} html
 */
LinksCollector.prototype.parseHTML = function(guidebook, html) {

    var self = this, currentId;

    currentId = guidebook.getIdD() + '';

    if (currentId.split(':').length - 1 >= self.config.crawler.deep) {
        self.emit('collected', guidebook, null);
        return;
    }

    // парсим тело ответа и сохраняем ссылки на внутренние
    // страницы сайта, добавляем их в путеводитель
    var parser, links = [],
        ignore_list = self.config.crawler.ignore,
        ignore_regexp = new RegExp("^\/+$" + ignore_list.replace(/\|/g,"|\\.") + "|^\/*#+.*$|^mailto:|^file:|^ftp:|^#.{1,}$");

    parser = new htmlparser2.Parser({
        onopentag : function(name, attrs) {

            if (name != 'a') return;

            if (! ('href' in attrs)) return;

            if ('rel' in attrs && attrs.rel == 'nofollow' && self.config.crawler.perceiveNofollow) {
                return;
            }

            if (attrs.href.toLowerCase().match(ignore_regexp) == null) {

                // избавляем текущую ссылку от ненужных частей
                var currentDomain = guidebook.getDomain();
                if (guidebook.getDomain().match(/^(?:http|https):\/\/(.+)/) != null) {
                    currentDomain = url.parse(guidebook.getDomain()).hostname + '/';
                }

                // иногда ссылки на странице указаны абсолютно
                if (attrs.href.match(/^(?:http:|https:|\/\/)(.+)/) != null) {

                    // и иногда это ссылки на внешние ресурсы, которые нас не интересуют
                    if (url.parse(attrs.href).hostname != currentDomain) {
                        return;
                    }

                    if (currentDomain == attrs.href) return;

                } else {
                    if (self.addHostname) {
                        attrs.href = currentDomain + attrs.href;
                    }
                }

                // если ссылка еще не встречалась, мы сохраняем ее в список
                // и в индекс, чтобы в дальнейшем ее не проходить
                if (!(attrs.href in self.cacheMap)) {
                    attrs.href = attrs.href.replace(/\/\//gi, '/');
                    links.push(attrs.href);
                    self.cacheMap[attrs.href] = true;
                }
            }

            /**
             * @todo добавить проверку значений robots.txt, отдельная задача
             */
        },
        'onend' : function() {

            self.emit('collected', guidebook, links);

        },
        'onerror' : function(guidebook, err) {

            self.emit('error', guidebook, err);

        }
    });

    parser.write(html);
    parser.end();
}

module.exports = LinksCollector;