# Copyright (c) 2015 Institute of the Czech National Corpus
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License
# as published by the Free Software Foundation; version 2
# dated June, 1991.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.

import urllib

from translation import ugettext as _
import l10n
from datetime import datetime
import manatee


class Export(object):
    """
    Exports query_storage plug-in's record into a form usable by KonText's user interface
    """

    types = {
        'iquery': _('Basic'),
        'lemma': _('Lemma'),
        'phrase': _('Phrase'),
        'word': _('Word Form'),
        'char': _('Character'),
        'cql': 'CQL'
    }

    def __init__(self, corpus_manager, corpname_canonizer):
        """
        arguments:
        corpus_manager -- a corplib.CorpusManager instance
        corpname_canonizer -- a function producing canonical corpus name from internal one (see kontext.py)

        """
        self._cm = corpus_manager
        self._canonize_corpname = corpname_canonizer
        self._corp_cache = {}

    def _open_corpus(self, corpname):
        if corpname not in self._corp_cache:
            self._corp_cache[corpname] = manatee.Corpus(corpname)
        return self._corp_cache[corpname]

    def _load_pos_map(self, corpname):
        poslist = self._cm.corpconf_pairs(self._open_corpus(corpname), 'LPOSLIST')
        if not poslist:
            poslist = self._cm.corpconf_pairs(self._open_corpus(corpname), 'WPOSLIST')
        return dict((y, x) for x, y in poslist)

    def _action_details(self, corpname, query_type, data):
        ans = []
        if not data:
            return ''
        else:
            pos_map = self._load_pos_map(corpname)
            if query_type == 'word':
                if data.get('wpos', None):
                    ans.append(pos_map.get(data['wpos'], '?'))
                if data.get('qmcase', None):
                    ans.append(_('case sensitive') if data['qmcase'] else _('case insensitive'))
            elif query_type == 'lemma' and data.get('lpos', None):
                ans.append(pos_map.get(data['lpos'], '?'))
            elif query_type == 'cql' and data.get('default_attr', None):
                ans.append(_('default attr.: %s') % data['default_attr'])
            return ', '.join(ans)

    @staticmethod
    def _action_url(row):
        url_params = {}
        url_params.update(row)
        url_params['query'] = urllib.quote(url_params['query'])
        query_url = [('first_form?corpname=%(corpname)s&%(query_type)s=%(query)s&queryselector=%(query_type)srow'
                      '&usesubcorp=%(subcorpname)s') % url_params]
        for k, v in url_params.get('params', {}).items():
            query_url.append('%s=%s' % (k, urllib.quote(str(v))))
        return '&'.join(query_url)

    def export_row(self, row):
        out_row = {}
        out_row.update(row)
        out_row['query_form_url'] = self._action_url(row)
        created_dt = datetime.fromtimestamp(row['created'])
        out_row['humanCorpname'] = self._canonize_corpname(row['corpname'])
        out_row['created'] = (created_dt.strftime(l10n.date_formatting()),
                              created_dt.strftime(l10n.time_formatting()))
        out_row['details'] = self._action_details(row['corpname'], row['query_type'], out_row.get('params', None))
        out_row['query_type_translated'] = Export.types.get(row['query_type'], '?')
        return out_row