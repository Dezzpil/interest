/**
 * Created by dezzpil on 21.11.13.
 */

var mongoose = require('mongoose'),
    schemas = require('./schemas');

function mongoDriver() {

    var self = this,
        loggers = null,

        impressSchema = mongoose.Schema(schemas.impress),
        textSchema = mongoose.Schema(schemas.text),
        ferryTaskSchema = mongoose.Schema(schemas.ferry_task),

        impressModel = mongoose.model('impress',impressSchema),
        textModel = mongoose.model('text', textSchema),
        ferryTaskModel = mongoose.model('ferry_task', ferryTaskSchema),

        connection = null,
        options = {
            "host" : "localhost",
            "port" : 27017,
            "db" : "crawler",
            "password" : "",
            "username" : "",
            "reconnectTimeout" : 10000
        }; 

    /**
     * @link http://mongoosejs.com/docs/guide.html Indexes
     */
    impressSchema.set('autoIndex', false);
    textSchema.set('autoIndex', false);
    ferryTaskSchema.set('autoIndex', false);


    self.setLoggers = function(object) {
        loggers = object;
        return self;
    };
    
    self.setConfig = function(cfg) {
        options = cfg;
        return self;
    };

    self.connect = function() {

        // mongoose.connect('mongodb://username:password@host:port/database?options...');
        var path = 'mongodb://' +
            options.username + ':' +
            options.password + '@' +
            options.host + ':' +
            options.port + '/' + options.db;

        mongoose.connect(path);

        connection = mongoose.connection
            .on('error', function(err) {
                loggers.file.info(err);
                loggers.console.info('connection to MongoDB error:', err);
                var delay = setTimeout(function() {
                    clearTimeout(delay);
                    self.connect();
                }, options.reconnectTimeout);
            })
            .on('connected', function() {
                loggers.file.info('MONGODB - connection established!');
                loggers.console.info('connection to MongoDB established');
            })
            .on('reconnected', function() {
                loggers.file.info('MONGODB - connection REestablished!');
                loggers.console.info('connection to MongoDB REestablished');
            })
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
            category :guidebook.getCategory(),
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

    self.makeTextFromImpress = function(impress, content, callback) {

        textModel.find({'url_id' : impress.url_id }, function(result) {

            var count = result ? result.length : 0, text;

            loggers.file.info('%s making text from impress : count of text documents - ', impress.url_id, count);

            if (count == 1) {

                return result.update({
                    date : impress.date,
                    pid : impress.pid,
                    url : impress.url,
                    content : content,
                    length : content.length,
                    category : impress.category,
                    is_indexed : false
                }, function(err, text) {
                    loggers.file.info('%s updating success', impress.url_id, err);
                    callback(err, text);
                });
            }

            if (count > 1) {

                textModel.remove({ url_id : impress.url_id }, function(err) {
                    loggers.file.info('%s removing success', impress.url_id, err);
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
                loggers.file.info('%s text inserting success', impress.url_id, err);
                callback(err, text);
            });

        })
    };

    self.setImpressFerried = function(impress, callback) {

        impressModel.findById(impress._id, function(err, impressDoc) {
            impressDoc.update({batched: true}, function(err, impress) {
                callback(err, impress);
            });
        });

    }

}

exports.driver = new mongoDriver();