/**
 * Created by root on 26.03.14.
 * @todo all files in folder collector must inherits from collector ?
 */

var util         = require('util');
var htmlparser2  = require("htmlparser2");
var EventEmitter = require('events').EventEmitter;
var fnstore      = require('./../lib/functionStore');

/**
 *
 * Имеет 2 события: collected & error
 * @event collected возвращает guidebook, {String}
 * @event error возвращает guidebook, {Object}
 *
 * @constructor
 */
function TextsCollector() {

    EventEmitter.call(this);

    this.storageFn = fnstore.forge();

    // set behavior to mediator
    this.storageFn.store('oncode', function(text) {
        return '';
    });
    this.storageFn.store('ontext', function(text) {
        return text;
    });

    this.normalizeText = function(text) {
        // TODO spread for optimiations
        // replace html entities to ''

        //var textPrepared = text.replace(/(&.{1,6};)/g, ' ');
        var textPrepared = text;

        // replace many \s to one ' '
        textPrepared = textPrepared.replace(/\s+|\&nbsp;/g, ' ');

        // any instances of <, >, & (except for normal element usage) needing
        // to be replaced with &lt;, &gt; and &amp; respectively
        textPrepared = textPrepared.replace(/\</g, '&lt;');
        textPrepared = textPrepared.replace(/\>/g, '&gt;');
        textPrepared = textPrepared.replace(/\&/g, '&amp;');

        return textPrepared.trim();
    }
    
}

util.inherits(TextsCollector, EventEmitter);
TextsCollector.prototype.parseHTML = function(guidebook, html) {

    var textInParser = '', titleInParser = '',
        inTitle = false, parser, self = this,
        storageFnName = 'ontext';

    parser = new htmlparser2.Parser({

        onopentag: function(tagname, attribs) {

            storageFnName = 'ontext';
            if (tagname == 'script' || tagname == 'style') {
                storageFnName = 'oncode';
            } else if (tagname == 'title') {
                inTitle = true;
            }
        },

        onclosetag: function(tagname) {

            if (tagname == "script" || tagname == 'style') {
                storageFnName = 'ontext';
            } else if (inTitle && tagname == 'title') {
                inTitle = false;
            }

            textInParser += ' ';
        },

        ontext: function(text) {
            if (inTitle) {
                titleInParser += (self.storageFn.obtain(storageFnName))(text);
            } else {
                textInParser += (self.storageFn.obtain(storageFnName))(text);
            }
        },

        onerror: function(err) {
            self.emit('error', guidebook, err);
        },

        onend: function() {
            var title = self.normalizeText(titleInParser);
            var content = self.normalizeText(textInParser);

            self.emit('collected', guidebook, content, title);
        }

    });

    parser.write(html);
    parser.end();
    
};

module.exports = TextsCollector;