// Running daemon
require('daemon')();

// Require need libs for daemon
var cluster = require('cluster'),
    cpusCount = require('os').cpus().length,

    processWorkersCount = cpusCount,
    helperWorkersCount = cpusCount,

    // open with fs to prevent caching in require,
    // so we can require config each time for each script when reload
    fs = require('fs'),
    configFile = fs.readFileSync('./configs/config.json', { 'flag' : 'r' }),
    config = JSON.parse(configFile);

/**
 * Creates a new worker when running as cluster master.
 * Runs the Crystal Interest Bot otherwisworkerse.
 */
function createProcessWorker() {
    if (cluster.isMaster) {
        // Fork a worker if running as cluster master
        var child = cluster.fork();

        // Respawn the child process after exit
        // (ex. in case of an uncaught exception)
        child.on('exit', function (code, signal) {
            createProcessWorker();
        });
    } else {
        require('./bot');
    }
}

/**
 * Creates a new worker when running as cluster master.
 * Runs the Crystal Interest Bot Helper otherwisworkerse.
 */
function createHelperWorker() {
    if (cluster.isMaster) {
        // Fork a worker if running as cluster master
        var child = cluster.fork();

        // Respawn the child process after exit
        // (ex. in case of an uncaught exception)
        child.on('exit', function (code, signal) {
            createHelperWorker();
        });
    } else {
        require('./helper');
    }
}

/**
 * Creates the specified number of workers.
 * @param  {Number} n Number of workers to create.
 */
function createWorkers() {
    var n = processWorkersCount,
        m = helperWorkersCount;

    while (n-- > 0) {
        createProcessWorker();
    }

    while (m-- > 0) {
        createHelperWorker();
    }
}

/**
 * Kills all workers with the given signal.
 * Also removes all event listeners from workers before sending the signal
 * to prevent respawning.
 * @param  {Number} signal
 */
function killAllWorkers(signal) {
    var uniqueID,
        worker;

    for (uniqueID in cluster.workers) {
        if (cluster.workers.hasOwnProperty(uniqueID)) {
            worker = cluster.workers[uniqueID];
            worker.removeAllListeners();
            worker.process.kill(signal);
        }
    }
}

/**
 * Restarts the workers.
 */
process.on('SIGHUP', function () {
    killAllWorkers('SIGTERM');
    createWorkers(numCPUs);
});

/**
 * Gracefully Shuts down the workers.
 */
process.on('SIGTERM', function () {
    killAllWorkers('SIGTERM');
});


// defautl values
if (config.daemon.workers.process) {
    processWorkersCount = config.daemon.workers.process;
}

if (config.daemon.workers.helper) {
    helperWorkersCount = config.daemon.workers.helper;
}

// run, Forest, run!
createWorkers();