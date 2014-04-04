/**
 * Created by root on 26.03.14.
 */

/**
 * Извлечь значение первого ключа объекта
 * @todo вынести в отдельную библиотеку
 * @todo подключить свою либу (?)
 * @param {object} object
 * @returns {*}
 */
function unshift(object) {
    var elem = null, i;
    for (i in object) {
        elem = object[i];
        delete(object[i]);
        break;
    }

    return elem;
}

exports.unshift = unshift;