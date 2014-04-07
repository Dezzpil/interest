/**
 * Created by dezzpil on 22.11.13.
 */

var url = require('url');

/**
 * Instance of guidebook pulled to link processing for data presentation about link and
 * avail mark end of process for the loop on the top of process.
 * @example link.js:71
 * @param guide {LinksGuide}
 * @param index {number}
 * @returns {LinksGuideBook}
 * @constructor
 */
function LinksGuideBook(guide, index) {

    var i = index,
        parent = guide,
        marked = false,
        linkIds = parent.getIdList(),
        linkMap = parent.getIdMap(),
        linkList = parent.getList(),
        finCallback = null;

    this.isEmpty = parent.isEmpty;

    this.setQueueCallback = function(callback) {
        finCallback = callback;
    };

    /**
     *
     * @param {Function} callback
     */
    this.markLink = function(callback) {
        marked = true;
        if (parent.markLink(this.getIdD())) {
            if (callback) callback();
            finCallback();
        }
    };

    /**
     *
     * @returns {boolean}
     */
    this.isMarked = function() {
        return marked;
    }

    /**
     *
     * @returns {boolean}
     */
    this.isSub = function() {
        var idD = linkIds[i] + '';
        if (idD.split(':').length > 1) {
            return true;
        }
        return false;
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
function LinksGuide(rows) {

    var i,
        index = 0,
        linkMap = {},
        linkListTmp = [], // для постоянного unshifta
        linkList = [], // для сравнения (не должен изменяться)
        linkIds = [],
        linkReadyList = [],

        sublinkList = [], // список ссылок, собираемый со страницы текущей ссылки

        self = this;

    /**
     * Добавить данные о ссылке в список гида
     * @param {{ idD: number, link: string }} linkData
     * @returns {LinksGuide}
     */
    self.add = function(linkData) {

        if ( ! ('link' in linkData)) {
            linkData['link'] = linkData['domain'];
        }

        if (linkData['link'].indexOf('http://') + 1 == 0) {
            linkData['link'] = 'http://' + linkData['link'];
        }

        // merge object to prevent save by link
        var idD = linkData['idD'], attrname, parsedURL;

        // bad link
        parsedURL = url.parse(linkData['link']);
        if (!parsedURL.hostname || parsedURL.hostname.length == 0) return self;

        linkMap[idD] = {};
        for (attrname in linkData) { linkMap[idD][attrname] = linkData[attrname]; }

        linkIds.push(linkData['idD']);
        linkList.push(linkData['link']);
        linkListTmp.push(linkData['link']);
        return self;
    }

    /**
     * Отформатировать данные в правильный формат для добавления
     * с помощью функции add. Используется для формирования зависимых ссылок
     * @param {LinksGuideBook} guidebook
     * @param {String} link
     * @param {Number} index
     * @returns {Object}
     */
    function format(guidebook, link, index) {
        sublinkList.push(link);

        var idD = guidebook.getIdD() + ':' + index,
            data = guidebook.getLinkData();

        data.idD = idD;
        data.link = link;

        return data;
    }

    /**
     * @param {LinksGuideBook} guidebook
     * @param {string} link
     * @returns {LinksGuide}
     */
    self.addSub = function(guidebook, link, index) {
        var data = format(guidebook, link, index);
        return self.add(data);
    };

    if (rows && rows.length) {
        for (i in rows) {

            self.add(rows[i]);
        }
    }

    delete(i);

    self.next = function() {
        index++;
        return linkListTmp.shift();
    };

    self.isEmpty = function() {
        return (linkListTmp.length == 0);
    };

    self.getIdMap = function() {
        return linkMap;
    };

    self.getIdList = function() {
        return linkIds;
    };

    self.getList = function() {
        return linkList;
    };

    self.getReadyList = function() {
        return linkReadyList;
    };

    self.markLink = function(idD) {
        if (linkReadyList.indexOf(idD) + 1 > 0)
            return false;

        linkReadyList.push(idD);
        return true;
    };

    /**
     *
     * @returns {LinksGuideBook}
     */
    self.getGuideBook = function() {
        return (new LinksGuideBook(self, index));
    }

}

module.exports = LinksGuide;