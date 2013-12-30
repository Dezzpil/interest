/**
 * Created by dezzpil on 22.12.13.
 *
 * send request to local domains (utf8.interest.bot, cp1251.interest.bot and so on)
 * in queue and get response. Then try to find out what encoding we got.
 * Try to convert it to utf-8
 *
 *
 *
 * @todo Перенести в утилс/ Использовать модуль из респонсь.жс, чтобы определять
 *       кодировку сайтов
 */

var http = require('http'),
    https = require('https'),
    url = require('url'),
    exec = require('child_process').exec,
    Iconv = require('iconv').Iconv,
    links = [
        'mkrf.ru'
//        'utf8.interest.bot',
//        'cp1251.interest.bot',
//        'windows-1251.interest.bot',
//        'koi8-r.interest.bot',
//        'utf-8.interest.bot'
    ],
    options = {
        hostname: 'bash.im',
        port: 80,
        path: '/',
        method: 'GET',
        headers: {
            'connection' : 'keep-alive'
        }
    };
;