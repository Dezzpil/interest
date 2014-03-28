/**
 * Created by root on 28.03.14.
 */

function badwordsFromFile() {

    this.cache = require('./../../configs/badwords.json');

    this.list = function(callback) {
        callback(this.cache);
    }

}

module.exports = badwordsFromFile;