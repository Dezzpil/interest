/**
 * Created by dezzpil on 22.11.13.
 */

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

        if (linkData['link'].indexOf('http') + 1 == 0) {
            linkData['link'] = 'http://' + linkData['link'];
        }

        // merge object to prevent save by link
        var idD = linkData['idD'], attrname;
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
     * @param {string} link
     * @returns {Object}
     */
    function format(guidebook, link) {
        sublinkList.push(link);

        var index = sublinkList.length - 1,
            idD = guidebook.getIdD() + ':' + index,
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
    self.addSub = function(guidebook, link) {
        var data = format(guidebook, link);
        return self.add(data);
    };

    if (rows && rows.length) {
        for (i = 0; i < rows.length; i++) {
            rows[i]['link'] = rows[i]['domain'];
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