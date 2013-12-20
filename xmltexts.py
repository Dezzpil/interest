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
    """
    <?xml version="1.0" encoding="utf-8"?>
    <sphinx:docset>

    <sphinx:schema>
        <sphinx:field name="url"/>
        <sphinx:field name="content"/>
        <sphinx:attr name="created" type="timestamp"/>
    </sphinx:schema>
    """

    sys.stdout.write('<?xml version="1.0" encoding="utf-8"?>\n<sphinx:docset>\n')

    sys.stdout.write('<sphinx:schema>\n')
    sys.stdout.write('\t<sphinx:field name="url"/>\n')
    sys.stdout.write('\t<sphinx:field name="content"/>\n')
    sys.stdout.write('\t<sphinx:field name="date"/>\n')
    sys.stdout.write('</sphinx:schema>\n\n')


def xml_end():
    sys.stdout.write('</sphinx:docset>\r\n')


def xml_document(text):
    """
    <sphinx:document id="1234">
        <url>note how field/attr tags can be</url>
        <content>this is the main content <![CDATA[[and this <cdata> entry
        must be handled properly by xml parser lib]]></content>
        <date>1012325463</date>
        <misc>some undeclared element</misc>
    </sphinx:document>
    """

    doc = unicode(text['content'])

    try:
        etree.Element('content').text = etree.CDATA(doc)
    except ValueError as e:
        sys.stderr.write("Value error :" + str(e) + "\n")
        return False

    try:
        sys.stdout.write('\t<sphinx:document id="' + str(text['url_id']) + '">\n\
        <url>' + str(text['url']) + '</url>\n\
        <content><![CDATA[' + doc.encode('utf-8') + ']]></content>\n\
        <date>' + str(text['date']) + '</date>\n\
    </sphinx:document>\n\n'.encode('utf-8'))
    except UnicodeError as e:
        sys.stderr.write("Unicode error " + str(e) + "\n")
        return False

    return True


def main():
    """
        Argv for this script will define for what
        category of children xml will form
        Argv like [n] - 0, 1, 2
        If 0 - reindex all
    """
    category = 0
    if len(sys.argv) >= 2:
        category = sys.argv[1]

    # get data from config
    cfg_file = open(os.path.join(os.path.dirname(__file__), 'configs/config.json'))
    config = json.load(cfg_file, 'utf-8')

    docs_num_each = config['xmlpipe2']['documentsNumEachExec']
    docs_mark_as_ready = config['xmlpipe2']['documentsMarkOnReady']

    mongo_host = config['mongo']['host']
    mongo_db = config['mongo']['db']
    mongo_port = config['mongo']['port']

    # TODO add username and pass for connect to mongoDB
    # http://api.mongodb.org/python/current/api/pymongo/mongo_client.html#pymongo.mongo_client.MongoClient

    client = MongoClient(mongo_host, mongo_port)
    db = client[mongo_db]

    if category:
        texts = db.texts.find({'category': category, 'is_indexed': False})\
            .sort('date', ASCENDING)\
            .limit(docs_num_each)
    else:
        texts = db.texts.find({'is_indexed': False})\
            .sort('date', ASCENDING)\
            .limit(docs_num_each)

    xml_start()
    for text in texts:
        if xml_document(text) & docs_mark_as_ready:
            text['index_date'] = datetime.datetime.today()
            text['is_indexed'] = True
            db.texts.save(text)

    xml_end()


if __name__ == '__main__':
    main()