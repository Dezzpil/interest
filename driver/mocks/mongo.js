/**
 * Created by dezzpil on 10.01.14
 */

function mongoMockDriver(options) {

    var self = this,
        logger = options.logger,
        config = options.config.mongo,
        connection = null;

    self.connect = function(callback) {
        loggerProcess.info('MONGODB - connection established!');
        if (callback) callback()
    };

    /**
     * Find page documents by page id, sorted DESC by date_created
     * @param {string} id
     * @param {function} callback
     */
    self.findPagesById = function(id, callback) {
        if (callback) callback(null, {})
    };

    /**
     * Find page documents by url, sorted DESC by date_created
     * @param {string} url
     * @param {function} callback
     */
    self.findPagesByUrl = function(url, callback) {
        if (callback) callback(null, {})
    };

    /**
     *
     * @param {Function} callback
     */
    self.findPageWithMaxUid = function(callback) {
        if (callback) callback(null, null);
    }

    /**
     * Save new page document, get err and page document in callback
     * @param {LinksGuideBook} guidebook
     * @param {Number} uid
     * @param {String} title
     * @param {String} content
     * @param {{change_percent: number, isBad: boolean, badWord: string}} analyzeResult
     * @param {function} callback
     */
    self.savePage = function(guidebook, uid, title, content, analyzeResult, callback) {
        if (callback) callback(null, {});
    };

    /**
     * Remove excess of page documents.
     * If We need to keep one page document (the given one)
     * @param {object} page
     * @param {function} callback
     */
    self.removePrevPages = function(page, callback) {
        if (callback) callback(null, {});
    };

    /**
     * Удалить все документы
     * @param {function} callback
     */
    self.removeAllPages = function(callback) {
        if (callback) callback(null, {});
    }

    /**
     *
     * @param {object} page
     * @returns {boolean}
     */
    self.hasBadWord = function(page) {
        return page.has_bad_word;
    };

    /**
     *
     * @param {object} page
     * @returns {boolean}
     */
    self.isBadCharset = function(page) {
        return page.charset.toLowerCase() != 'utf-8';
    };

}

module.exports = mongoMockDriver()