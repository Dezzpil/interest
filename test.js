/**
 * Created by root on 27.03.14.
 */

(function(){
    var config = require('./configs/config.json');
    var AnalyzeDriver = require('./drivers/analyze/node');

    var analyzer = new AnalyzeDriver({config : config, logger : null});

    analyzer.on('error', console.log);
    analyzer.on('success', console.log);

    analyzer.write('bar foo')
    analyzer.write('foo bar');
})()
