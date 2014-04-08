
var EventEmitter   = require('events').EventEmitter;
var util           = require('util');
var async          = require('async');

/**
 * Сохранятель для успешного случая
 * Created by dezzpil on 31.03.14.
 * @param {{config: {Object}, logger: {loggers Object}, mysql: {MysqlDriver}, mongo: {MongoDriver}}} options
 * @param {Number} start_uid Начальное значение uid для документов page
 */
function PageManager(options, start_uid) {

    EventEmitter.call(this);

    var self = this,
        config = options.config,
        logger = options.logger,
        mysql = options.mysql,
        mongo = options.mongo,
        uid = start_uid;

    /**
     * Сохранить страницу и пометить домен как проверенный
     * @param {LinksGuideBook} guidebook
     * @param {String} text
     * @param {String} title
     * @param {Object} result
     * @param {NUmber} code
     */
    this.save = function(guidebook, text, title, result, code) {

        code = code ? code : 200;

        // проверить наличие обязательных данных
        // для сохранения, при отсутствии одного из них,
        // надо падать с ошибкой. Это не исключительная ситуация
        // а ошибка, если мы что-то забыли передать в объект

        if (guidebook == null) {
            throw new Error(self.constructor.name + ': guidebook not setted!');
        }

        if (result == null) {
            throw new Error(self.constructor.name + ': analyze result not setted!');
        }

        if (text == null) {
            throw new Error(self.constructor.name + ': text not setted!');
        }

        // сохраняем данные
        uid++;
        var idD = guidebook.getIdD();

        async.parallel([
            function(callback) {
                mongo.savePage(guidebook, uid, title, text, result, function(err, page) {
                    if (err) logger.info('%s ERROR WHILE SAVING PAGE', idD, err);
                    else {
                        logger.info('%s PAGE SAVED', idD);
                    }
                    callback(err, true);
                });
            },
            function(callback) {
                mysql.setInfoForLink(
                    guidebook, code, result.change_percent, result.badword_id,
                    function(err, rows) {
                        if (err) logger.info('%s ERROR DOMAIN ROW UPDATING AFTER ANALYZING', idD, err);
                        else logger.info('%s DOMAIN ROW UPDATED AFTER ANALYZING', idD);
                        callback(err, null);
                    }
                );
            }
        ], function(error, results) {
            self.emit('saved', guidebook, uid);
        });
    }

}

util.inherits(PageManager, EventEmitter);
module.exports = PageManager;