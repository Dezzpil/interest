/**
 * Created by dezzpil on 3/25/14.
 */


// start server
(function(){

    var net           = require('net');
    var config        = require('./../configs/config.json');
    var analyzeServer = net.createServer();
    var analyzeWorker = require('./worker');

    analyzeServer.on('connection', function(con) {
        console.log('new connection');
        con.on('end', function() {
            console.log('connection end');
        });

        con.setEncoding('utf8');
        con.setKeepAlive(true, 100);

        var data = [], worker;

        con.on('data', function(buffer) {
            data.push(buffer);
        });

        con.on('end', function(buffer) {
            data.push(buffer);

            worker = new analyzeWorker({});
            worker.on('success', function(result) {});
            worker.on('error', function(err) {});
        });

    });

    analyzeServer.listen(config.analyzer.port, function() {
        console.log('server bound');
    });

})()