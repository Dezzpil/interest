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
                content : String,
                length : Number
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

    self.findPrevData = function(link, callback) {
        impressModel.find(
            { url : link }, null, { sort : { date : -1}, limit : 1 },
            function(err, result) {
                if (err) loggers.file.log(err);
                callback(result);
            }
        );
    };

    self.saveNewData = function(link, pid, content, callback) {
        var impress = new impressModel({
            date : new Date(),
            pid : pid,
            url : link,
            content : content,
            length : content.length
        });

        impress.save(function(error, impress) {
            if (callback) callback(error, impress);
        });


    };

}

exports.driver = new mongoDriver();