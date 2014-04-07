/**
 * Created by dezzpil on 4/8/14.
 */

var PageManager    = require('./../manager/page');
var LoggerFactory  = require('./../driver/loggers');
var MongoDriver    = require('./../driver/mongo');
var MysqlDriver    = require('./../driver/mocks/mysql');
var LinksGuide     = require('./../lib/linksGuide');
var AnalyzeDriver  = require('./../driver/analyze/node');
var config         = require('./../configs/config.json');
var async          = require('async');


(function() {

    var mongo, mysql, guide,
        logger = LoggerFactory.forge(
        config.loggers.tests.type,
        config.loggers.tests.options
    ),
        options = {
        'config' : config,
        'logger' : logger
    };

    mongo = new MongoDriver(options);
    mysql = new MysqlDriver(options);
    guide = new LinksGuide();

    async.parallel([
        function(callback) {
            mongo.connect(function(err) {
                callback(null, true);
            });
        },
        function(callback) {
            mysql.connect(function(err) {
                callback(null, true);
            });
        }
    ], function(error, results) {
        if (error) {
            logger.info(error);
            process.exit(1);
        }

        options.mysql = mysql;
        options.mongo = mongo;

        // find page with max uid, and save max uid
        mongo.findPageWithMaxUid(function(error, page) {

            logger.info(page.toString());
            logger.info('UID OF LAST PAGE DOCUMENT IS %d', page.uid);

            var uid = 0;
            if (page && page.uid >= 0) uid = page.uid;

            var pageManager = new PageManager(options, uid);

            mysql.getLinks(1, 1, function(err, data) {

                guide.add(data[0]);
                var guidebook = guide.getGuideBook(),
                    analyzer = new AnalyzeDriver(options);

                pageManager.on('saved', function(guidebook, uid) {
                    logger.info('NEW UID GENERATED %d', uid);
                    process.exit();
                });

                pageManager.save(guidebook, 'dezzpil.ru text', analyzer.getDummyResult());
            });
        });





    });

})();