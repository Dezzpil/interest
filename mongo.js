/**
 * Created by dezzpil on 21.11.13.
 */

var systemCfg = require('./configs/config.json'),
    mongoose = require('mongoose');


function mongoDriver() {

    var self = this,
        loggers = null,
        options = systemCfg.mongo,
        impressModel = mongoose.model('impress',
            mongoose.Schema({
                date : Date,
                pid : Number,
                url : String,
                url_id : Number,
                content : String,
                length : Number,
                category : Number
            })
        ),
        textModel = mongoose.model('text',
            mongoose.Schema({
                date : Date,
                pid : Number,
                url : String,
                url_id : Number,
                content : String,
                length : Number,
                category : Number
            })
        ),
        batchInfoModel = mongoose.model('impress_complete_calendar',
            mongoose.Schema({
                date : Date,
                pid : Number,
                url_ids : Array
            })
        ),


        connection = null;

    self.setLoggers = function(object) {
        loggers = object;
        return self;
    };

    this.connect = function() {

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
    }

    self.findPrevData = function(linkId, callback) {
        impressModel.find(
            { url_id : linkId }, null, { sort : { date : -1}, limit : 1 },
            function(err, result) {
                callback(err, result);
            }
        );
    };

    self.saveNewData = function(guidebook, pid, content, callback) {
        var impress = new impressModel({
            date : new Date(),
            pid : pid,
            content : content,
            length : content.length,
            url : guidebook.getDomain(),
            url_id : guidebook.getIdD(),
            category :guidebook.getCategory()
        });

        impress.save(function(error, impress) {
            if (callback) callback(error, impress);
        });


    };

    self.saveBatchInfo = function(linkIdLst, pid, callback) {
        var impressBatchInfo = new batchInfoModel({
            date : new Date(),
            pid : pid,
            url_ids : linkIdLst
        });

        impressBatchInfo.save(function(error, batchInfo) {
            if (callback) callback(error, batchInfo);
        });
    };

}

exports.driver = new mongoDriver();