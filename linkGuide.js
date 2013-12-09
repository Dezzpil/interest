/**
 * Created by dezzpil on 22.11.13.
 */

function forge(rows, loggers) {
    return new LinkGuide(rows, loggers);
}

function LinkGuide(rows, loggers) {

    var i,
        index = 0,
        linkMap = {},
        linkListTmp = [], // для постоянного unshifta
        linkList = [], // для сравнения (не должен изменяться)
        linkIds = [],
        readyList = [],
        self = this,
        loggers = loggers;

    if (rows && rows.length) {
        for (i = 0; i < rows.length; i++) {
            linkMap[rows[i]['idD']] = rows[i];
            linkList.push(rows[i]['domain']);
            linkListTmp.push(rows[i]['domain']);
            linkIds.push(rows[i]['idD']);
        }
    } else {
        throw new Error('instance of LinkGuide gets empty rows list!');
    }

    delete(i);

    this.next = function() {
        index++;
        return linkListTmp.shift();
    };

    this.isEmpty = function() {
        return (linkListTmp.length == 0);
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
        if (readyList.indexOf(idD) + 1 > 0) return ;

        readyList.push(idD);
    };

    this.getGuideBook = function() {

        var i = index,
            parent = self,
            finCallback = null;

        loggers.console.info('%d starts %s', linkIds[i], linkList[i]);
        loggers.console.profile(linkList[i]);

        this.isEmpty = parent.isEmpty;

        this.setCallback = function(callback) {
            finCallback = callback;
        };

        /**
         *
         */
        this.markLink = function() {
            parent.markLink(this.getIdD());

            finCallback();
            loggers.console.info('%d ends %s', linkIds[i], linkList[i]);
            loggers.console.profile(linkList[i]);
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

        this.getCategory = function() {
            // до времени пока нет поля для категории в данных
            if ('category' in linkMap[linkIds[i]]) {
                return linkMap[linkIds[i]]['category'];
            } else {
                return 0;
            }
        }

        return this;
    }

}

exports.forge = forge;