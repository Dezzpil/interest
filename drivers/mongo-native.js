/**
 * Created by dezzpil on 27.12.13.
 * @todo try to implement like mongo.js
 */
var Db = require('mongodb').Db,
    Server = require('mongodb').Server,
    Collection = require('mongodb').Collection,
    MongoClient = require('mongodb').MongoClient;

function mongoNativeDriver() {

    var self = this,
        loggers = null,
        connection = null,
        options = {},
        hooks = {
            'connected' : []
        }

    self.setLoggers = function(object) {
        loggers = object;
        return self;
    };

    self.setConfig = function(cfg) {
        options = cfg;
        return self;
    };

    self.connect = function(callback) {

//        db = new Db(
//            options.db,
//            new Server(options.host, options.port),
//            {safe:true}
//        );
//
//        db.open(function(err, db) {
//            console.log('EEEEEEEEeaaa');
//            if (callback) callback(err, db);
//        });

        var path = 'mongodb://';
        if (options.username) {
            path += options.username + ':';
            path += options.password + '@';
        }

        path += options.host + ':' +
            options.port + '/' + options.db;

        MongoClient.connect(path, function(err, db) {
            connection = db;
            callback(err, db);

            if ( ! err) {
                for (i in hooks.connected) {
                    fn = hooks.connected[i];
                    fn(db);
                }
            }

        });

    };

    self.onConnection = function(callback) {
        if (typeof callback == 'function') {
            hooks.connected.push(callback);
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
                info += 'mongo: Collection ' + collections[name] + ' exists\n';
            } catch (e) {
                new Collection(db, name);
                info += 'mongo: Create collection' + collections[name] + '\n';
            }
        }

        callback(info);
    }

}

exports.driver = new mongoNativeDriver();