/**
 * Created by root on 01.04.14.
 */

var RequestManager = require('./../request');
var LinksManager   = require('./../link');
var LoggersFactory = require('./../drivers/loggers');
var LinksGuide     = require('./../libs/linksGuide');
var DomainDriver   = require('./../drivers/mocks/mysql');
var config         = require('./../configs/config.json');

(function() {

    var logger = LoggersFactory.forge(
        config.loggers.tests.type,
        config.loggers.tests.options
    );

    var requestManager, linksManager,
        options = {
            config : config,
            logger : logger
        };

    var domainDriver = new DomainDriver(options);
    options.mysql = domainDriver;

    linksManager = new LinksManager(options, function(guidebook) {

        requestManager = new RequestManager(options);
        requestManager.on('success', function(data) {

            data.guidebook.markLink(function() {
                logger.info('%s COMPLETE', data.guidebook.getIdD());
            });

        });

        requestManager.run(guidebook);
    });

    linksManager.on('empty', function() {
        logger.info('ITERATION EMPTY ... ');
    });

    linksManager.on('start', function() {
        logger.info('ITERATION START');
    });

    linksManager.on('end', function(guide) {
        logger.info('ITERATION COMPLETE');
        //process.exit();
    });

    domainDriver.getLinks(0, function(err, data) {
        logger.info(data);
        linksManager.run(new LinksGuide(data));
    });

})();