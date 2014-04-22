/**
 * Created by root on 01.04.14.
 */

var RequestManager = require('./../manager/request');
var LinksManager   = require('./../manager/link');
var LoggersFactory = require('./../driver/loggers');
var LinksGuide     = require('./../lib/linksGuide');
var mock_data      = require('./mock_data.json');
var config         = require('./../configs/config.json');


(function() {

    var logger = LoggersFactory.forge(
        config.loggers.tests.type,
        config.loggers.tests.options
    );

    var requestManager,
        linksManager,
        options = {
            config : config,
            logger : logger
        };

    linksManager = new LinksManager(options, function(guidebook) {

        requestManager = new RequestManager(options);
        requestManager.on('response', function(guidebook, response) {

            guidebook.markLink(function() {
                logger.info('%s COMPLETE', guidebook.getIdD());
            });

        });

        requestManager.run(guidebook);
    });

    linksManager.on('empty', function() {
        logger.info('ITERATION EMPTY ... ');
        process.exit();
    });

    linksManager.on('start', function() {
        logger.info('ITERATION START');
    });

    linksManager.on('end', function(guide) {
        logger.info('ITERATION END');
    });

    linksManager.on('terminated', function(guide) {
        logger.info('ITERATION TERMINATED');
        process.exit(1);
    });

    var data = [], i;
    for (i in mock_data) {
        data.push(mock_data[i]);
    }

    linksManager.run(new LinksGuide(data));


})();