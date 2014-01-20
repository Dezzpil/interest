/**
 * Created by dezzpil on 10.01.14
 */

function mongoMockDriver() {

    var self = this, config = {},
        logger = null, connection = null;

    self.setLogger = function(object) {
        logger = object;
        return self;
    };
    
    self.setConfig = function(cfg) {
        config = cfg;
        return self;
    };

    self.connect = function(callback) {
        logger.info('MONGODB - connection established!');
    };

    /**
     * Обнулить все собранные ботом данные
     * Данные восстановить не удасться !!!
     */
    self.removeAllDocs = function(callback) {};

    self.getImpress = function(linkId, callback) {
        callback(null, {});
    };

    self.saveNewImpress = function(guidebook, pid, charset, html, analyzeResult, callback) {
        if (callback) callback(null, {});
    };

    self.isContainBadWord = function(impress) {
        return impress.containBadWord;
    };

    self.isBadCharset = function(impress) {
        return impress.charset.toLowerCase() != 'utf-8';
    };

    self.saveFerryTask = function(linkIdLst, pid, callback) {
        callback(null, {});
    };

    self.getFerryTask = function(callback) {
        return callback(null, {});
    };

    self.getText = function(urlId, callback) {
        //
    };

    self.removeText = function(urlId, callback) {
        //
    };

    /**
     *
     * @param impress {object}
     * @param content {string}
     * @param callback {function}
     */
    self.makeTextFromImpress = function(impress, content, callback) {
        callback(null, {});
    };

    /**
     * Remove excess of impress.
     * We need to keep one impress document (the last one) after text complete
     * @param impress {object}
     * @param callback {function}
     */
    self.removeExcessImpresses = function(impress, callback) {
        callback(null, {});
    };

    /**
     * Mark that we done text document from impress document
     * @param impress {object}
     * @param callback {function}
     */
    self.setImpressFerried = function(impress, callback) {
        callback(null, {});
    };

}

exports.driver = new mongoMockDriver();