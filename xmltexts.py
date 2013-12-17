__author__ = 'dezzpil'

# TODO put params in config.json and parse it here

import sys
import datetime
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
    sys.stdout.write('</sphinx:docset>')


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
    sys.stdout.write('<sphinx:document id="' + str(text['url_id']) + '">\n')
    sys.stdout.write('\t<url>' + str(text['url']) + '</url>\n')
    sys.stdout.write('\t<content>' + text['content'] + '</content>\n')
    sys.stdout.write('\t<date>' + str(text['date']) + '</date>\n')
    sys.stdout.write('</sphinx:document>\n\n')


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

    ## 'mongodb://localhost:27017/'
    client = MongoClient('localhost', 27017)
    db = client['crawler']

    if category:
        texts = db.texts.find({'category': category, 'is_indexed': False}).sort('date', ASCENDING).limit(1000)
    else:
        texts = db.texts.find({'is_indexed': False}).sort('date', ASCENDING).limit(1000)

    xml_start()
    for text in texts:
        try:
            xml_document(text)
        except UnicodeDecodeError:
            continue

        text['index_date'] = datetime.datetime.today()
        text['is_indexed'] = True
        db.texts.save(text)

    xml_end()
    quit()


if __name__ == '__main__':
    main()