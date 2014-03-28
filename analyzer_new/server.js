/**
 * Created by dezzpil on 3/25/14.
 */


// start server
(function(){

    var net            = require('net');
    var config         = require('./../configs/config.json');
    var badwordsDriver = require('./badwords/file');
    var analyzeServer  = net.createServer();
    var analyzeWorker  = require('./worker');

    var options = {};
    var serverPresentation = "analyzer : ";

    analyzeServer.on('connection', function(con) {
        console.log(serverPresentation + 'new connection');
        con.on('end', function() {
            console.log(serverPresentation + 'connection end');
        });

        con.setEncoding('utf8');
        con.setKeepAlive(true, 100);

        var data = [], worker;

        // create worker and config it
        worker = new analyzeWorker({});
        worker.on('complete', function(result) {
            con.write(result);
        });
        worker.on('error', function(err) {
            con.write(err);
        });

        // set handler on incoming data
        con.on('data', function(buffer) {
            data.push(buffer.toString());

            console.log(data);
            if (data.length >= 2) {
                worker.work(data);
            }
        });

    });

    analyzeServer.listen(config.analyzer.port, function() {
        console.log(serverPresentation + 'server bound');

        // get list of bad words
        var badwords = new badwordsDriver();
        badwords.list(function(list) {
            console.log(serverPresentation + 'get list of bad words!', list);
            //console.log('get list of bad words!', list);
            options.badwordslist = list;
        })
    });

})()