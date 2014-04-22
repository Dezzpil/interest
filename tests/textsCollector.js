/**
 * Created by root on 01.04.14.
 */

var LoggersFactory = require('./../driver/loggers');
var TextsCollector = require('./../collector/texts');
var LinksGuide     = require('./../lib/linksGuide');
var config         = require('./../configs/config.json');
var mock_text      = require('./mock_html_text.json');
var async          = require('async');

(function() {
    var logger, i, testHmlList = [],
        guide, guidebook;

    logger = LoggersFactory.forge(
        config.loggers.tests.type,
        config.loggers.tests.options
    );

    guide = new LinksGuide([{idD : 0, link : 'le.et'}]);
    guidebook = guide.getGuideBook();

    for (i in mock_text) {
        testHmlList.push(mock_text[i]);
    }

    async.each(testHmlList, function(test, callback) {
        var textsCollector = new TextsCollector();
        textsCollector.on('collected', function(guidebook, text) {

            var expected = test.assert,
                given = text;

            logger.info('Expected [' + expected + ']; Given [' + given + ']')

            if (expected == given) callback();
            else callback('assertion fails');

        });

        textsCollector.parseHTML(guidebook, test.html);
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