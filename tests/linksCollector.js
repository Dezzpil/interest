/**
 * Created by root on 01.04.14.
 */

var LoggersFactory = require('./../driver/loggers');
var LinksCollector = require('./../collector/links');
var LinksGuide     = require('./../lib/linksGuide');
var config         = require('./../configs/config.json');
var mock_html      = require('./mock_html_links.json');
var async          = require('async');

(function() {
    var logger, options, i, testHmlList = [],
        guide, guidebook;

    logger = LoggersFactory.forge(
        config.loggers.tests.type,
        config.loggers.tests.options
    );
    options = {
        config: config,
        logger: logger,
        addHostname : false // add host part to the begin of string
    };

    guide = new LinksGuide([{idD : 0, link : 'le.et'}]);
    guidebook = guide.getGuideBook();

    for (i in mock_html) {
        testHmlList.push(mock_html[i]);
    }

    async.each(testHmlList, function(test, callback) {
        var linksCollector = new LinksCollector(options);
        linksCollector.on('collected', function(guidebook, links) {

            var expected = test.assert.sort().toString(),
                given = links.sort().toString();

            logger.info('Expected ' + expected + '; Given ' + given)

            if (expected == given) callback();
            else callback('assertion fails');

        });

        linksCollector.parseHTML(guidebook, test.html);
    }, function(err){
        if (err) {
            logger.info(err);
            process.exit(1);
        } else {
            logger.info('assertions was successfully verified');
            process.exit();
        }
    });

})();