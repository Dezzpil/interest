/**
 * Created by dezzpil on 21.11.13.
 */

var mongoose = require('mongoose'),
    schemas = require('./schemas');

function mongoDriver() {

    var self = this,
        logger = null,

        impressSchema = mongoose.Schema(schemas.impress),
        textSchema = mongoose.Schema(schemas.text),
        ferryTaskSchema = mongoose.Schema(schemas.ferry_task),

        impressModel = mongoose.model('impress',impressSchema),
        textModel = mongoose.model('text', textSchema),
        ferryTaskModel = mongoose.model('ferry_task', ferryTaskSchema),

        connection = null,
        options = {};

    /**
     * @link http://mongoosejs.com/docs/guide.html Indexes
     */
    impressSchema.set('autoIndex', false);
    textSchema.set('autoIndex', false);
    ferryTaskSchema.set('autoIndex', false);


    self.setLogger = function(object) {
        logger = object;
        return self;
    };
    
    self.setConfig = function(cfg) {
        options = cfg;
        return self;
    };

    self.connect = function(callback) {

        // mongoose.connect('mongodb://username:password@host:port/database?options...');
        var path = 'mongodb://' +
            options.username + ':' +
            options.password + '@' +
            options.host + ':' +
            options.port + '/' + options.db;

        if ( connection !== null) {
            callback();
        } else {
            mongoose.connect(path);
        }

        connection = mongoose.connection
            .on('error', function(err) {
                callback(err);
                var delay = setTimeout(function() {
                    clearTimeout(delay);
                    self.connect();
                }, options.reconnectTimeout);
                throw err;
            })
            .on('connected', function() {
                logger.info('MONGODB : connection established');
                callback();
            })
            .on('reconnected', function() {
                logger.info('MONGODB : connection reestablished');
            })
    };

    /**
     * Обнулить все собранные ботом данные
     * Данные восстановить не удасться !!!
     */
    self.removeAllDocs = function(callback) {

        impressModel.remove({}, function(err) {
            if (err) callback(err);
            else textModel.remove({}, function(err) {
                if (err) callback(err);
                else ferryTaskModel.remove({}, function(err) {
                    callback(err);
                });
            });

        });

    };

    self.getImpress = function(linkId, callback) {
        impressModel.find(
            { url_id : linkId }, null, { sort : { date : -1}, limit : 1 },
            function(err, result) {
                callback(err, result);
            }
        );
    };

    self.saveNewImpress = function(guidebook, pid, charset, html, analyzeResult, callback) {
        impressModel.create({
            date : new Date(),
            pid : pid,
            content : html,
            length : html.length,
            url : guidebook.getDomain(),
            url_id : guidebook.getIdD(),
            category :guidebook.getGroups(),
            charset : charset,
            changePercent : analyzeResult.percent,
            containBadWord : analyzeResult.isBad,
            badWord : analyzeResult.badWord,
            batched : false
        }, function(error, impress) {
            if (callback) callback(error, impress);
        });
    };

    self.isContainBadWord = function(impress) {
        return impress.containBadWord;
    };

    self.isBadCharset = function(impress) {
        return impress.charset.toLowerCase() != 'utf-8';
    };

    self.saveFerryTask = function(linkIdLst, pid, callback) {
        var impressBatchInfo = new ferryTaskModel({
            date : new Date(),
            pid : pid,
            url_ids : linkIdLst
        });

        impressBatchInfo.save(function(error, batchInfo) {
            callback(error, batchInfo);
        });
    };

    self.getFerryTask = function(callback) {
        ferryTaskModel.findOneAndRemove( null, { sort : { 'date' : -1}}, function(err, result) {
        //ferryTaskModel.findOne({}, {}, {sort : { 'date' : -1}}, function(err, result) {
            if ( ! result) return callback('MongoDB : No ferry tasks!');
            return callback(err, result);
        });
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

        textModel.find({'url_id' : impress.url_id }, function(result) {

            var count = result ? result.length : 0, text;

            logger.info('%s making text from impress : count of text documents - ', impress.url_id, count);

            if (count == 1) { // update and return

                return result.update({
                    date : impress.date,
                    pid : impress.pid,
                    url : impress.url,
                    content : content,
                    length : content.length,
                    category : impress.category,
                    is_indexed : false
                }, function(err, text) {
                    logger.info('%s updating success', impress.url_id, err);
                    callback(err, text);
                });
            }

            if (count > 1) { // remove all prev texts and going on

                textModel.remove({ url_id : impress.url_id }, function(err) {
                    logger.info('%s removing success', impress.url_id, err);
                    callback(err);
                });
            }

            text = new textModel({
                date : impress.date,
                pid : impress.pid,
                url : impress.url,
                url_id : impress.url_id,
                content : content,
                length : content.length,
                category : impress.category,
                is_indexed : false,
                index_date : new Date()
            });

            text.save(function(err, text) {
                logger.info('%s text inserting success', impress.url_id, err);
                callback(err, text);
            });

        })
    };

    /**
     * Remove excess of impress.
     * We need to keep one impress document (the last one) after text complete
     * @param impress {object}
     * @param callback {function}
     */
    self.removeExcessImpresses = function(impress, callback) {
        impressModel.remove({_id : { $ne : impress._id}, url_id : impress.url_id}, callback);
    };

    /**
     * Mark that we done text document from impress document
     * @param impress {object}
     * @param callback {function}
     */
    self.setImpressFerried = function(impress, callback) {

        impressModel.findById(impress._id, function(err, impressDoc) {
            impressDoc.update({batched: true}, function(err, impress) {
                callback(err, impress);
            });
        });

    };
}

exports.driver = new mongoDriver();