/**
 * Created by dezzpil on 27.12.13.
 */

var Collection = require('mongodb').Collection,
    MongoClient = require('mongodb').MongoClient;

function mongoNativeDriver() {

    var self = this,
        logger = null,connection = null,
        options = {}, hooks = {
            'connected' : []
        }

    self.setLogger = function(object) {
        loggerProcess = object;
        return self;
    };

    self.setConfig = function(cfg) {
        options = cfg;
        return self;
    };

    self.connect = function(callback) {

        var path = 'mongodb://';
        if (options.username) {
            path += options.username + ':';
            path += options.password + '@';
        }

        path += options.host + ':' +
            options.port + '/' + options.db;

        MongoClient.connect(path, function(err, db) { //noinspection JSCheckFunctionSignatures

            connection = db;
            callback(err);

            if ( ! err) {
                while (hooks.connected.length > 0) {
                    var fn = hooks.connected.shift();
                    if (fn) fn();
                }
            }

        });

    };

    self.onConnection = function(callback) {
        if (typeof callback == 'function') {
            if (connection) {
                callback(null);
            } else {
                hooks.connected.push(callback);
            }
        }
    };

    /**
     * Retrieve the statistics for the collection
     * @param collectionName
     * @param callback
     */
    self.stats = function(collectionName, callback) {
        if (collectionName) return ; // TODO

        connection.stats(function(err, stats) {
            callback(err, stats);
        });
    };

    /**
     * Make TTL index for log collection
     * @param callback
     */
    self.ensureLogTTL = function(callback) {
        var logColl = connection.collection('log');
        logColl.ensureIndex({ 'timestamp' : 1 }, { expireAfterSeconds: 3600 * 24 }, function(err, index) {
            callback(err);
        });
    };

    /**
     * If collections doesn't exist - create them
     * @param callback
     */
    self.checkCollections = function(callback) {

        var name,
            //collections = ['impresses', 'texts', 'log', 'ferry_tasks', 'tmp_texts'],
            collections = ['impresses', 'texts', 'log', 'ferry_tasks'],
            info = '';

        for (name in collections) {
            try {
                connection.collection(name);
                info += collections[name] + ' exists; ';
            } catch (e) {
                new Collection(db, name);
                info += collections[name] + ' created; ';
            }
        }

        callback(info);
    }

}

exports.driver = new mongoNativeDriver();