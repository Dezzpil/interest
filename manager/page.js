
var EventEmitter   = require('events').EventEmitter;
var util           = require('util');

/**
 * Сохранятель для успешного случая
 * Created by dezzpil on 31.03.14.
 */
function PageManager(options) {

    EventEmitter.call(this);

    var self = this,
        config = options.config,
        logger = options.logger,
        mysql = options.mysql,
        mongo = options.mongo;

    this.save = function(guidebook, text, result, code) {

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

        if (code == null) {
            throw new Error(self.constructor.name + ': code not setted!');
        }

        // сохраняем данные
        var idD = guidebook.getIdD();

        mongo.savePage(guidebook, text, result, function(err, page) {
            if (err) logger.info('%s ERROR WHILE SAVING PAGE', idD, err);
            else logger.info('%s PAGE SAVED', idD);
        });

        mysql.setInfoForLink(
            guidebook, code, result.change_percent, result.badword_id,
            function(err, rows) {
                if (err) logger.info('%s ERROR DOMAIN ROW UPDATING AFTER ANALYZING', idD, err);
                else logger.info('%s DOMAIN ROW UPDATED AFTER ANALYZING', idD);
            }
        );
    }

}

util.inherits(PageManager, EventEmitter);
module.exports = PageManager;