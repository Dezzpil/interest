/**
 * Created by dezzpil on 22.11.13.
 */

var execFile = require('child_process').execFile,
    queryString = require('querystring');

function analyzeFactory() {

    var instances = [],
        count = 0,
        self = this,
        loggers,
        options = {
            "path" : "/home/crystal-crawler/",
            "fileName" : "proj",
            "maxInstances" : 100,
            "killSignal" : 'SIGINT'
        };

    this.setOptions = function(cfg) {
        options = cfg;
        return self;
    };

    this.setLoggers = function(object) {
        loggers = object;
        return self;
    }

    this.getInstances = function() {
        return instances;
    };

    this.empty = function() {
        for (var i = 0; i < instances.length; i++) {
            instances[i].kill(options.killSignal);
        }

        instances = [];
        count = 0;
    };

    this.forge = function() {
        /**
         * Мы можем открыть одновременно 1360 дочерних процессов
         * (Количество я вычислил эмпирически, и, имхо, кол-во зависит от конфига компа,
         * так что я предпочитаю очень маленькие возможности)
         *
         * Сами они иногда не закрываются, по разным причинам.
         * Мы просто чистим список включенных файлов, если их становится много
         */

        if (self.getInstances().length > 100) {
            self.empty();
        }

        return new Analyzer();
    };

    function Analyzer() {

        var process,
            self = this,
            num = -1,
            isTerminated = false;

        this.run = function(readyCallback, errorCallback, completeCallback) {

            if ( isTerminated) return false;

            process = execFile(
                options.path + options.fileName,
                function (error, stdout, stderr) {

                    if (error) {

                        errorCallback(error);

                    } else if (stderr) {

                        errorCallback(stderr);

                    } else {

                        var analyzeResult = parseAnalyzeResult(stdout);
                        if (readyCallback) readyCallback(analyzeResult);

                        if (completeCallback) {
                            self.killAnalyzer(completeCallback);
                        } else {
                            self.killAnalyzer();
                        }

                    }
                }
            );

            process.stdin.setEncoding = 'utf-8';
            process.stdin
                .once('drain', function() {
                    //
                }).on('finish', function() {
                    //
                }).on('pipe', function(src) {
                    //
                }).on('unpipe', function(src) {
                    //
                });

            process.on('exit', function() {
                //
            });

            num = count;
            instances[num] = process;
            count++;

            loggers.file.info("ANALYZER EXEC. COUNT: %d, %d", instances.length, count);
        };

        this.write = function(text) {
            process.stdin.write(
                queryString.escape(text) + '\n',
                'utf8'
            );
        }

        /**
         *
         * @param outputString
         * @returns {{percent: number, isBad: boolean}}
         */
        function parseAnalyzeResult(outputString) {

            var vals = outputString.split('|');

            return {
                'percent' : parseInt(((1000 - vals[0]) / 1000) * 100),
                'isBad' : false
            }
        }

        /**
         *
         * @param callback
         */
        this.killAnalyzer = function(callback) {

            isTerminated = true;
            var err = null;

            try {
                if (process) { // если процесс уже создан
                    process.stdin.end();
                    process.kill(options.killSignal);
                    delete(process);
                    delete(instances[num]);
                    count--;
                }
            } catch (e) {
                err = e;
            }

            if (callback) callback(err);

        }

    }

}

exports.factory = analyzeFactory;