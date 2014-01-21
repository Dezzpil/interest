/**
 * Created by dezzpil on 22.11.13.
 */

function forge(rows) {
    return new LinkGuide(rows);
}


/**
 * Instance of guidebook pulled to link processing for data presentation about link and
 * avail mark end of process for the loop on the top of process.
 * @example link.js:71
 * @param guide {LinkGuide}
 * @param index {number}
 * @returns {LinkGuideBook}
 * @constructor
 */
function LinkGuideBook(guide, index) {

    var i = index,
        parent = guide,
        linkIds = parent.getIdList(),
        linkMap = parent.getIdMap(),
        linkList = parent.getList(),
        finCallback = null;

    this.isEmpty = parent.isEmpty;

    this.setCallback = function(callback) {
        finCallback = callback;
    };

    /**
     *
     */
    this.markLink = function(callback) {
        if (parent.markLink(this.getIdD())) {
            callback();
            finCallback();
        }

    };

    /**
     *
     * @returns {number}
     */
    this.getIndex = function() {
        return i;
    };

    /**
     *
     * @returns {number}
     */
    this.getIdD = function() {
        return linkIds[i];
    };

    /**
     *
     * @returns {object}
     */
    this.getLinkData = function() {
        return linkMap[linkIds[i]];
    };

    /**
     *
     * @returns {string}
     */
    this.getDomain = function() {
        return linkList[i];
    };

    /**
     *
     * @returns {Array}
     */
    this.getGroups = function() {

        if ('groups' in linkMap[linkIds[i]]) {
            return linkMap[linkIds[i]]['groups'].split(',');
        } else {
            return [];
        }
    };

    return this;

}


/**
 *
 * @param rows {Array}
 * @constructor
 */
function LinkGuide(rows) {

    var i,
        index = 0,
        linkMap = {},
        linkListTmp = [], // для постоянного unshifta
        linkList = [], // для сравнения (не должен изменяться)
        linkIds = [],
        readyList = [],
        self = this;

    if (rows && rows.length) {
        for (i = 0; i < rows.length; i++) {
            linkMap[rows[i]['idD']] = rows[i];
            linkList.push(rows[i]['domain']);
            linkListTmp.push(rows[i]['domain']);
            linkIds.push(rows[i]['idD']);
        }
    }
//    else {
//        throw new Error('instance of LinkGuide gets empty rows list!');
//    }

    delete(i);

    this.next = function() {
        index++;
        return linkListTmp.shift();
    };

    this.isEmpty = function() {
        return (linkListTmp.length == 0);
    };

    this.getIdMap = function() {
        return linkMap;
    };

    this.getIdList = function() {
        return linkIds;
    };

    this.getList = function() {
        return linkList;
    };

    this.getReadyList = function() {
        return readyList;
    };

    this.markLink = function(idD) {
        if (readyList.indexOf(idD) + 1 > 0)
            return false;

        readyList.push(idD);
        return true;
    };

    /**
     *
     * @returns {LinkGuideBook}
     */
    this.getGuideBook = function() {
        return (new LinkGuideBook(self, index));
    }

}

exports.forge = forge;