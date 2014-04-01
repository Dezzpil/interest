/**
 * Смотри подробное описание реализации в
 * worker.js
 *
 * Created by dezzpil on 3/25/14.
 */
(function(){

    var net            = require('net');
    var config         = require('./../configs/config.json');
    var badwordsDriver = require('./badwords/file');
    var analyzeServer  = net.createServer();
    var analyzeWorker  = require('./worker');

    var options = {};
    var serverPresentation = "analyzer : ";

    // получить список стоп-слов, и
    // поднять сервер по их получении

    var badwords = new badwordsDriver();
    badwords.list(function(list) {

        options.badwordslist = list;
        analyzeServer.listen(config.analyzer.port, function() {
            console.log(serverPresentation + 'server bound');
        });

        analyzeServer.maxConnections = config.analyzer.maxConnections;

    });

    analyzeServer.on('connection', function(con) {

        console.log(serverPresentation + 'start connection');

        con.on('end', function() {
            console.log(serverPresentation + 'end connection');
        });

        con.setEncoding('utf8');
        con.setKeepAlive(true, 100);
        //con.pipe(con);

        var data = [], worker;

        worker = new analyzeWorker(options);
        worker.on('complete', function(result) {
            console.log(serverPresentation + 'send response to client', result);
            result = JSON.stringify(result);
            con.end(result);
        });
        worker.on('error', function(err) {
            con.end(err);
        });

        con.on('data', function(buffer) {
            data.push(buffer.toString());
            if (data.length >= 2) {
                worker.work(data);
                data = [];
            }
        });

    });

})();