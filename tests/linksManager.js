/**
 * Created by root on 01.04.14.
 */

var LoggersFactory = require('./../driver/loggers');
var LinksManager   = require('./../manager/link');
var LinksGuide     = require('./../lib/linksGuide');
var DomainDriver   = require('./../driver/mocks/mysql');
var config         = require('./../configs/config.json');

(function() {

    var readyGuidebooks = [];
    var logger = LoggersFactory.forge(
            config.loggers.tests.type,
            config.loggers.tests.options
        );
    var options = { config: config, logger: logger };

    var linksManager = new LinksManager(options, function(guidebook) {
        readyGuidebooks.push(guidebook);
        guidebook.markLink(function() {
            logger.info('guidebook %s iterated', guidebook.getDomain());
        });
    });

    linksManager.on('end', function(guide) {
        logger.info('all links iterated');
        process.exit();
    });
    linksManager.on('terminated', function(guide) {
        logger.info('some links hasn\'t been iterated');
        process.exit(1);
    });

    var domainDriver = new DomainDriver(options);
    options.mysql = domainDriver;

    domainDriver.getLinks(0, config.iteration.count, function(err, data) {
        linksManager.run(new LinksGuide(data));
    });

})();