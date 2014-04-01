/**
 * Created by root on 01.04.14.
 */

var LoggersFactory = require('./../drivers/loggers');
var LinksManager   = require('./../link');
var LinksGuide     = require('./../libs/linksGuide');
var DomainDriver   = require('./../drivers/mocks/mysql');
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

    domainDriver.getLinks(0, function(err, data) {
        linksManager.run(new LinksGuide(data));
    });

})();