/**
 * Created by root on 13.12.13.
 */


function forge() {
    return (new FunctionStorage());
}

function FunctionStorage() {

    var self = this,
        mediateMap = {},
        storageMap = {};

    this.store = function(eventName, fn) {
        if (eventName in mediateMap && typeof mediateMap[eventName] == 'function') {
            storageMap[eventName] = mediateMap[eventName];
        }
        mediateMap[eventName] = fn;
    };

    this.restore = function(eventName) {
        if (eventName in storageMap && typeof storageMap[eventName] == 'function') {
            self.store(eventName, storageMap[eventName]);
        }
    };

    this.obtain = function(eventName) {
        return mediateMap[eventName];
    };

}

exports.forge = forge;