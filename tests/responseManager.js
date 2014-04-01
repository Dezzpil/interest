/**
 * Created by root on 01.04.14.
 */

var ResponseManager = require('./../response');
var RequestManager = require('./../request');
var LinksManager   = require('./../link');
var LoggersFactory = require('./../drivers/loggers');
var LinksGuide     = require('./../libs/linksGuide');
var DomainDriver   = require('./../drivers/mocks/mysql');
var config         = require('./../configs/config.json');

(function(){

    var logger = LoggersFactory.forge(
        config.loggers.tests.type,
        config.loggers.tests.options
    );

    var requestManager, linksManager,
        responseManager,
        options = {
            config : config,
            logger : logger
        };

    var domainDriver = new DomainDriver(options);
    options.mysql = domainDriver;

    responseManager = new ResponseManager(options);
    responseManager.on('recoded', function(guidebook, bodyHTML) {
        guidebook.markLink(function() {
            logger.info('FINISH RESPONSE PROCESSING');
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

    domainDriver.getLinks(0, function(err, data) {
        linksManager.run(new LinksGuide(data));
    });

})();