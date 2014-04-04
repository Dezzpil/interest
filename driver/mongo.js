/**
 * Created by dezzpil on 21.11.13.
 */

var mongoose    = require('mongoose');
var Schema      = mongoose.Schema;
var schemas     = require('./schemas');

function mongoDriver(options) {

    var self = this,
        logger = options.logger,
        config = options.config.mongo,
        connection = null,
        path,
        pageSchema = new Schema(schemas.page),
        pageModel = mongoose.model('pages', pageSchema);

    path = 'mongodb://' + config.username + ':' + config.password + '@' +
        config.host + ':' + config.port + '/' + config.db;

    pageSchema.set('autoIndex', false);

    /**
     * Connect to mongodb
     * @param {function} callback
     */
    self.connect = function(callback) {

        if ( connection !== null) callback();
        else mongoose.connect(path);

        connection = mongoose.connection;
        connection.on('error', function(err) {
            callback(err);
            var delay = setTimeout(function() {
                clearTimeout(delay);
                self.connect();
            }, config.reconnectTimeout);
            throw err;
        });
        connection.on('connected', function() {
            logger.info('MONGODB : connection established');
            callback();
        });
        connection.on('reconnected', function() {
            logger.info('MONGODB : connection reestablished');
        })
    };

    /**
     * Find page documents by page id, sorted DESC by date_created
     * @param {string} id
     * @param {function} callback
     */
    self.findPagesById = function(id, callback) {
        pageModel.find(
            { id : id }, null, { sort : { date_created : -1}},
            function(err, result) {
                callback(err, result);
            }
        );
    };

    /**
     * Find page documents by url, sorted DESC by date_created
     * @param {string} url
     * @param {function} callback
     */
    self.findPagesByUrl = function(url, callback) {
        pageModel.find(
            { url : url }, null, { sort : { date_created : -1}},
            function(err, result) {
                callback(err, result);
            }
        );
    }

    /**
     * Save new page document, get err and page document in callback
     * @param {LinksGuideBook} guidebook
     * @param {String} text
     * @param {{change_percent: number, isBad: boolean, badWord: string}} analyzeResult
     * @param {function} callback
     */
    self.savePage = function(guidebook, text, analyzeResult, callback) {
        pageModel.create({
            id : guidebook.getIdD(),
            url : guidebook.getDomain(),
            category :guidebook.getGroups(),
            content : text,
            content_length : text.length,
            change_percent : analyzeResult.change_percent,
            badword_id : analyzeResult.badword_id,
            badword_context : analyzeResult.badword_context,
            date_created : new Date(),
            is_indexed : false
        }, function(error, page) {
            if (callback) callback(error, page);
        });
    };

    /**
     * Remove excess of page documents.
     * If We need to keep one page document (the given one)
     * @param {object} page
     * @param {function} callback
     */
    self.removePrevPages = function(page, callback) {
        pageModel.remove({_id : { $ne : page._id}, url : page.url}, callback);
    };

    /**
     * Удалить все документы
     * @param {function} callback
     */
    self.removeAllPages = function(callback) {
        pageModel.remove({}, callback);
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

module.exports = mongoDriver;