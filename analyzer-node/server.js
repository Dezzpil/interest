/**
 * Смотри подробное описание реализации в
 * worker.js
 *
 * Created by dezzpil on 3/25/14.
 */

var cluster  = require('cluster');
var net      = require('net');
var numCPUs  = require('os').cpus().length;


(function(){

    var config         = require('./../configs/config.json');
    var badwordsDriver = require('./badwords/file');
    var analyzeServer  = net.createServer();
    var analyzeWorker  = require('./worker');

    var options = {};
    var serverPresentation = process.pid + " analyzer : ";

    // получить список стоп-слов, и
    // поднять сервер по их получении

    if (cluster.isMaster) {

        // Fork workers.
        for (var i = 0; i < numCPUs; i++) {
            cluster.fork();
        }

        cluster.on('exit', function(worker, code, signal) {
            console.log('worker ' + worker.process.pid + ' died');
            cluster.fork();
        });

    } else {

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

            analyzeServer.getConnections(function(err, count) {
                console.log(serverPresentation + 'connection count - %s', count);
            });

            con.on('end', function() {
                console.log(serverPresentation + 'end connection');
            });

            con.setEncoding('utf8');
            con.setKeepAlive(true, 100);
            //con.pipe(con);

            var data = [], text = '', worker;

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

                // данные передаются порционно
                // чтобы определить где заканчивается первый
                // текст, передается разделитель в виде \n\r (вынести в конфиг).
                // При получении разделителя - данные должны собираться в одну строку
                // и сохраняться для передачи рабочему процессу

                console.log(serverPresentation + 'data read %s, buffer length %s', con.bytesRead, buffer.length);

                var chunk = buffer.toString();
                if (chunk != config.analyzer.chunkGlue) {
                    text += chunk;
                } else {
                    console.log(serverPresentation + 'get nr chunk!');
                    data.push(text);
                    text = '';
                }

                if (data.length >= 2) {
                    worker.work(data);
                }
            });

        });
    }

})();