
var EventEmitter   = require('events').EventEmitter;
var util           = require('util');

/**
 * Сохранятель для успешного случая
 * Created by dezzpil on 31.03.14.
 */
function PageSaver(options) {

    EventEmitter.call(this);

    var self = this,
        config = options.config,
        logger = options.logger,
        mysql = options.mysql,
        mongo = options.mongo,
        guidebook = null,
        result = null,
        text = null,
        code = null;

    this.setGuideBook = function(GuideBook) {
        guidebook = GuideBook;
    };

    this.setAnalyzeResult = function(Result) {
        result = Result;
    };

    this.setText = function(Text) {
        text = Text;
    };

    this.setStatusCode = function(Code) {
        code = Code;
    };

    this.save = function() {

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

        guidebook.markLink(function() {
            mongo.savePage(guidebook, text, result, function(err, page) {
                if (err) logger.info('%s ERROR WHILE SAVING PAGE', idD, err);
                else logger.info('%s PAGE SAVED', idD);
            });

            mysql.setInfoForLink(
                idD, code, result.change_percent, result.badword_id,
                function(err, rows) {
                    if (err) logger.info('%s ERROR DOMAIN ROW UPDATING AFTER ANALYZING', idD, err);
                    else logger.info('%s DOMAIN ROW UPDATED AFTER ANALYZING', idD);
                }
            );
        });
    }

}

util.inherits(PageSaver, EventEmitter);
module.exports = PageSaver;