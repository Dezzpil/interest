/**
 * Created by root on 01.04.14.
 */

var ResponseManager = require('./../manager/response');
var RequestManager  = require('./../manager/request');
var LinksManager    = require('./../manager/link');
var LoggersFactory  = require('./../driver/loggers');
var LinksGuide      = require('./../lib/linksGuide');
var mock_data      = require('./mock_data.json');
var config          = require('./../configs/config.json');

(function(){

    var logger = LoggersFactory.forge(
        config.loggers.tests.type,
        config.loggers.tests.options
    );

    var requestManager, linksManager, responseManager,
        options = {
            config : config,
            logger : logger
        };

    responseManager = new ResponseManager(options);
    responseManager.on('received', function(guidebook, bodyHTML, callback) {
        callback(guidebook, bodyHTML);
    });
    responseManager.on('recoded', function(guidebook, bodyHTML) {
        guidebook.markLink(function() {
            logger.info('%s FINISH PROCESSING', guidebook.getIdD());
        });
    });

    requestManager = new RequestManager(options);
    requestManager.on('response', function(guidebook, response) {
        responseManager.run(response, guidebook);
    });

    linksManager = new LinksManager(options, function(guidebook) {
        requestManager.run(guidebook);
    });
    linksManager.on('end', function() {
        process.exit(); // exit with success
    });
    linksManager.on('terminated', function() {
        process.exit(1); // exit with error
    });

    var data = [], i;
    for (i in mock_data) {
        data.push(mock_data[i]);
    }

    linksManager.run(new LinksGuide(data));

})();