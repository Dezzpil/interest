/**
 * Created by root on 17.04.14.
 */

var config = require('./config.json');
var async = require('async');
var mongo = require('mongodb').MongoClient;

var winston = require('winston');
var logger = new winston.Logger();

logger.add(winston.transports.File, {
    "filename" : "./../logs/stats.log",
    "maxsize" : 10485760,
    "maxFiles" : 5,
    "level" : "info",
    "json" : false,
    "prettyPrint" : true
});



var express = require('express');
var app = express();

/**
 *
 */
app.get('/', function(request, response) {

    //response.send('hello, world!');
    response.set('Content-Type', 'text/html');
    response.type('html');


    var response_text = '';

    function _(text) {
        response_text += text;
    }

    var path = 'mongodb://' + config.mongo.host + ':' + config.mongo.port + '/' + config.mongo.db;
    mongo.connect(path, function(err, db) {

        if (err) {

            response.send(503, err.stack);

        } else {

            var pages = db.collection('pages');

            _('<h1>' + (new Date()).toString() + '</h1>');

            _('<ol>');

            async.parallel([
                function(callback) {
                    pages.stats(function(err, stats) {
                        _('<li>Страниц обработано : ' + stats.count + '</li>');
                        _('<li>Вес коллекции в Мб : ' + (stats.size / 1024 / 1024) + '</li>');
                        _('<li>Средний вес страницы (как эл. коллекции) в Мб : ' + (stats.avgObjSize / 1024 / 1024) + '</li>');
                        _('<li>MongoDB выделил для коллекции место в Мб : ' + (stats.storageSize / 1024 / 1024) + '</li>');
                        callback(err, true);
                    });
                },
                function(callback) {
                    pages.count({'is_indexed': { '$ne': false}}, function(err, indexed_count) {
                        _('<li>Количество страниц в индексе Sphinx (только школный интернет): ' + indexed_count + '</li>');
                        callback(err, true);
                    });
                },
            ], function(err, result) {

                _('</ol>');

                logger.info(response_text);
                response.send(200, response_text);


                db.close();

            });

        }

    });





});

var server = app.listen(3000, function() {
    console.log('Listening on port %d', server.address().port);
});