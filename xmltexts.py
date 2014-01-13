__author__ = 'dezzpil'

# TODO put params in config.json and parse it here

import sys
import datetime
import json
import os
from lxml import etree
from pymongo import MongoClient
from pymongo import ASCENDING


def xml_start():
    sys.stdout.write('<?xml version="1.0" encoding="utf-8"?>\n<sphinx:docset>\n')

    sys.stdout.write('<sphinx:schema>\n')
    sys.stdout.write('\t<sphinx:field name="url"/>\n')
    sys.stdout.write('\t<sphinx:field name="content"/>\n')
    sys.stdout.write('\t<sphinx:field name="date"/>\n')
    sys.stdout.write('</sphinx:schema>\n\n')


def xml_end():
    sys.stdout.write('</sphinx:docset>\r\n')


def xml_document(text):
    doc = unicode(text['content'])

    try:
        etree.Element('content').text = etree.CDATA(doc)
    except ValueError as e:
        return False

    try:
        sys.stdout.write('\t<sphinx:document id="' + str(text['url_id']) + '">\n\
        <url>' + str(text['url']) + '</url>\n\
        <content><![CDATA[' + doc.encode('utf-8') + ']]></content>\n\
        <date>' + str(text['date']) + '</date>\n\
    </sphinx:document>\n\n'.encode('utf-8'))
    except UnicodeError as e:
        return False

    return True


def main():
    """
        Argv for this script will define for what
        category of children xml will form
        Argv like [n] - 0, 1, 2
        If -1 - reindex all
    """
    category = -1
    if len(sys.argv) >= 2:
        category = {
            '2-7': 1,
            '7-12': 2,
            'school': 3,
            'religion': 4
        }.get(sys.argv[1], -1)

	print(category)

    # get data from config
    cfg_file = open(os.path.join(os.path.dirname(__file__), 'configs/config.json'))
    config = json.load(cfg_file, 'utf-8')

    docs_num_each = config['xmlpipe2']['documentsNumEachExec']

    mongo_host = config['mongo']['host']
    mongo_db = config['mongo']['db']
    mongo_port = config['mongo']['port']

    # TODO add username and pass for connect to mongoDB
    # http://api.mongodb.org/python/current/api/pymongo/mongo_client.html#pymongo.mongo_client.MongoClient

    client = MongoClient(mongo_host, mongo_port)
    db = client[mongo_db]

    if category >= 0:
        texts = db.texts.find({'category': { '$all': [str(category)]}, 'is_indexed': False})\
            .sort('date', ASCENDING)\
            .limit(docs_num_each)
    else:
        texts = db.texts.find({'is_indexed': False})\
            .sort('date', ASCENDING)\
            .limit(docs_num_each)

    xml_start()
    for text in texts:
        if xml_document(text):
            text['index_date'] = datetime.datetime.today()
            text['is_indexed'] = True
            db.texts.save(text)

    xml_end()


if __name__ == '__main__':
    main()
