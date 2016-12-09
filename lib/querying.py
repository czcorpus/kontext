# Copyright(c) 2016 Charles University in Prague, Faculty of Arts,
#                   Institute of the Czech National Corpus
# Copyright(c) 2016 Tomas Machalek <tomas.machalek @ gmail.com>
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

# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

from collections import defaultdict

from kontext import Kontext
import corplib
import plugins
import l10n
import butils


def import_qs(qs):
    return qs[:-3] if qs is not None else None


class Querying(Kontext):
    """
    A controller for actions which rely on
    query input form (either directly or indirectly).
    """

    def __init__(self, request, ui_lang):
        super(Querying, self).__init__(request=request, ui_lang=ui_lang)

    def _fetch_query_params(self, only_active_corpora):
        corpora = self._get_current_aligned_corpora() if only_active_corpora else self._get_available_aligned_corpora()
        qinfo = defaultdict(lambda: {})
        for i, corp in enumerate(corpora):
            suffix = '_{0}'.format(corp) if i > 0 else ''
            qtype = import_qs(getattr(self.args, 'queryselector' + suffix, None))
            qinfo['query_types'][corp] = qtype
            qinfo['queries'][corp] = getattr(self.args, qtype + suffix, None) if qtype is not None else None
            qinfo['pcq_pos_neg_values'][corp] = getattr(self.args, 'pcq_pos_neg' + suffix, None)
            qinfo['lpos_values'][corp] = getattr(self.args, 'lpos' + suffix, None)
            qinfo['qmcase_values'][suffix] = bool(getattr(self.args, 'qmcase' + suffix, False))
            qinfo['default_attr_values'][suffix] = getattr(self.args, 'default_attr' + suffix, 'word')
        return corpora, qinfo

    def _attach_query_params(self, tpl_out):
        """
        Attach data required by client-side query component
        """
        corpus_info = self.get_corpus_info(self.args.corpname)
        tpl_out['metadata_desc'] = corpus_info['metadata']['desc']
        tpl_out['input_languages'] = {}
        tpl_out['input_languages'][self.args.corpname] = corpus_info['collator_locale']

        def tag_support(c):
            return plugins.has_plugin('taghelper') and plugins.get('taghelper').tag_variants_file_exists(c)

        corpora, qinfo = self._fetch_query_params(only_active_corpora=False)
        for corp in corpora:
            qinfo['tag_builder_support'][corp] = tag_support(corp)
        tpl_out['query_info'] = qinfo

    def _attach_aligned_query_params(self, tpl_out):
        """
        Adds template data required to generate components for adding/overviewing
        aligned corpora.

        arguments:
        tpl_out -- a dict where exported data is stored
        """
        if self.corp.get_conf('ALIGNED'):
            tpl_out['Aligned'] = []
            if not tpl_out.get('input_languages', None):
                tpl_out['input_languages'] = {}
            for al in self.corp.get_conf('ALIGNED').split(','):
                alcorp = corplib.open_corpus(al)
                tpl_out['Aligned'].append(dict(label=alcorp.get_conf('NAME') or al, n=al))
                attrlist = alcorp.get_conf('ATTRLIST').split(',')
                poslist = self.cm.corpconf_pairs(alcorp, 'WPOSLIST')
                tpl_out['Wposlist_' + al] = [{'n': x[0], 'v': x[1]} for x in poslist]
                if 'lempos' in attrlist:
                    poslist = self.cm.corpconf_pairs(alcorp, 'LPOSLIST')
                tpl_out['Lposlist_' + al] = [{'n': x[0], 'v': x[1]} for x in poslist]
                tpl_out['has_lemmaattr_' + al] = 'lempos' in attrlist \
                                                 or 'lemma' in attrlist
                tpl_out['input_languages'][al] = self.get_corpus_info(al).collator_locale

    def _export_subcorpora_list(self, corpname, out):
        """
        Updates passed dictionary by information about available sub-corpora.
        Listed values depend on current user and corpus.
        If there is a list already present in 'out' then it is extended
        by the new values.

        arguments:
        corpname -- corpus id
        out -- a dictionary used by templating system
        """
        basecorpname = corpname.split(':')[0]
        subcorp_list = l10n.sort(self.cm.subcorp_names(basecorpname), loc=self.ui_lang, key=lambda x: x['n'])
        if len(subcorp_list) > 0:
            subcorp_list = [{'n': '--%s--' % _('whole corpus'), 'v': ''}] + subcorp_list
        if out.get('SubcorpList', None) is None:
            out['SubcorpList'] = []
        out['SubcorpList'].extend(subcorp_list)

    def _export_aligned_form_params(self, aligned_corp, state_only, name_filter=None):
        """
        Collects aligned corpora-related arguments with dynamic names
        (i.e. the names with corpus name as a suffix)
        """
        if name_filter is None:
            def name_filter(v):
                return True

        args = ('include_empty', 'pcq_pos_neg')
        if not state_only:
            args += ('queryselector',)
        ans = {}
        for param_name in args:
            full_name = '%s_%s' % (param_name, aligned_corp)
            if full_name in self._request.args and name_filter(param_name):
                ans[full_name] = self._request.args[full_name]
        return ans

    def _save_query(self, query, query_type):
        if plugins.has_plugin('query_storage'):
            params = {}
            if query_type == 'lemma':
                params['lpos'] = self.args.lpos
            elif query_type == 'word':
                params['wpos'] = self.args.wpos
                params['qmcase'] = self.args.qmcase
            elif query_type == 'cql':
                params['default_attr'] = self.args.default_attr
            plugins.get('query_storage').write(
                user_id=self._session_get('user', 'id'), corpname=self.args.corpname,
                subcorpname=self.args.usesubcorp, query=query, query_type=query_type,
                params=params)

    def _query_contains_within(self):
        """
        Tests (by a super-simplified CQL parsing) whether there is a
        'within' expression in the current query (self.args.q).
        """
        if self.args.q is not None and len(self.args.q) > 0:
            within_part = butils.CQLDetectWithin().get_within_part(self.args.q[0])
            return within_part is not None and len(within_part) > 0
        return False
