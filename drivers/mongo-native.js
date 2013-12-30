/**
 * Created by dezzpil on 27.12.13.
 * @todo try to implement like mongo.js
 */
var Db = require('mongodb').Db,
    Server = require('mongodb').Server,
    Collection = require('mongodb').Collection;

function mongoNativeDriver() {

    var self = this,
        loggers = null,
        db = null,
        options = {};

    self.setLoggers = function(object) {
        loggers = object;
        return self;
    };

    self.setConfig = function(cfg) {
        options = cfg;
        return self;
    };

    self.connect = function(callback) {

        db = new Db(options.db, new Server(options.host, options.port), {safe:true});

    };

    self.stats = function(collectionName, callback) {

        db.open(function(err, db) {
            // Retrieve the statistics for the collection
            if (collectionName) return ; // TODO

            db.stats(function(err, stats) {
                callback(err, stats);
            });
        });
    };

    self.ensureTTL = function(callback) {
        db.open(function(err, db) {

            var logColl = db.collection('log');
            logColl.ensureIndex({ 'timestamp' : 1 }, { expireAfterSeconds: 3600 * 24 }, function(err, index) {
                callback(err);
            });

        });

    };

    self.checkCollections = function(callback) {

        var name,
            collections = ['impresses', 'texts', 'log', 'ferry_tasks'],
            info = '';

        db.open(function(err, db) {

            for (name in collections) {
                try {
                    db.collection(name);
                    info += 'mongo: Collection ' + collections[name] + ' exists\n';
                } catch (e) {
                    new Collection(db, name);
                    info += 'mongo: Create collection' + collections[name] + '\n';
                }
            }

            callback(info);
        });

    }

}

exports.driver = new mongoNativeDriver();