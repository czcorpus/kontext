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

from kontext import Kontext
import corplib
import plugins
import l10n
import butils
from translation import ugettext as _
from controller import exposed


def has_tag_support(corpname):
    return plugins.has_plugin('taghelper') and plugins.get('taghelper').tag_variants_file_exists(corpname)


class ConcFormArgs(object):
    """
    A helper class to handle miscellaneous
    form (filter, query, sort,...) args
    properly. It is used only indirectly
    - we create an instance and immediately
    after that we export it (either to serialize
    it via conc_persistence or to pass it
    to the client-side).
    """

    def __init__(self, persist):
        self._persistent = persist
        self._op_key = '__new__'

    def updated(self, attrs, op_key):
        """
        Return an updated self object
        (the same instance). There must
        be always the 'op_key' value
        present to emphasize the fact
        that only serialized data (i.e.
        data with their database key)
        can be used to update an 'unbound'
        instance.
        """
        for k, v in attrs.items():
            if k in vars(self):
                setattr(self, k, v)
        self._op_key = op_key
        return self

    def to_dict(self):
        tmp = dict((k, v) for k, v in self.__dict__.items() if not k.startswith('_'))
        if not self.is_persistent:
            tmp['op_key'] = self._op_key
        return tmp

    @property
    def is_persistent(self):
        return self._persistent

    @property
    def op_key(self):
        """
        op_key property has a special status as
        it is kept separate from other attributes
        and is exported only if an instance is
        persistent (= loaded from database). I.e.
        newly created objects (where op_key == '__new__')
        should not export it.
        """
        return self._op_key


class QueryFormArgs(ConcFormArgs):
    """
    QueryFormArgs collects arguments required
    to initialize the 'first_form' for one or more
    corpora.

    The class is only used to make collecting and
    serializing data easier. Stored data are expected
    to be JSON-serializable.
    """
    def __init__(self, corpora, persist):
        super(QueryFormArgs, self).__init__(persist)
        self.form_type = 'query'
        self.curr_query_types = dict((c, None) for c in corpora)
        self.curr_queries = dict((c, None) for c in corpora)
        self.curr_pcq_pos_neg_values = dict((c, None) for c in corpora)
        self.curr_lpos_values = dict((c, None) for c in corpora)
        self.curr_qmcase_values = dict((c, None) for c in corpora)
        self.curr_default_attr_values = dict((c, None) for c in corpora)
        self.tag_builder_support = dict((c, None) for c in corpora)
        for corp in self.tag_builder_support.keys():
            self.tag_builder_support[corp] = has_tag_support(corp)


class FilterFormArgs(ConcFormArgs):
    """
    FilterFormArgs collects arguments required
    to initialize the 'filter' form.

    The class is only used to make collecting and
    serializing data easier. Stored data are expected
    to be JSON-serializable.
    """
    def __init__(self, maincorp, persist):
        super(FilterFormArgs, self).__init__(persist)
        self.form_type = 'filter'
        self.query_type = 'iquery'
        self.query = ''
        self.maincorp = maincorp
        self.pnfilter = 'p'
        self.filfl = 'f'
        self.filfpos = '-5'
        self.filtpos = '5'
        self.inclkwic = True
        self.qmcase = False
        self.default_attr = 'word'
        self.tag_builder_support = has_tag_support(self.maincorp)


class SortFormArgs(ConcFormArgs):
    """
    SortFormArgs collects arguments required
    to initialize the 'sort' form.

    The class is only used to make collecting and
    serializing data easier. Stored data are expected
    to be JSON-serializable.
    """
    def __init__(self, persist):
        super(SortFormArgs, self).__init__(persist)
        self.form_type = 'sort'
        self.sattr = None
        self.skey = None
        self.spos = None
        self.sicase = None
        self.sbward = None


def build_conc_form_args(data, op_key):
    """
    A factory method to create a conc form args
    instance based on deserialized data from
    conc_persistnece database.
    """
    tp = data['form_type']
    if tp == 'query':
        return QueryFormArgs(corpora=data.get('corpora', []), persist=False).updated(data, op_key)
    elif tp == 'filter':
        return FilterFormArgs(maincorp=data['maincorp'], persist=False).updated(data, op_key)
    elif tp == 'sort':
        return SortFormArgs(persist=False).updated(data, op_key)
    else:
        raise ValueError('Cannot determine stored conc args class from type %s' % (tp,))


class Querying(Kontext):
    """
    A controller for actions which rely on
    query input form (either directly or indirectly).
    Put in different words, any action requiring
    self.args.q should be part of a class extended
    from this one.
    """

    def __init__(self, request, ui_lang):
        super(Querying, self).__init__(request=request, ui_lang=ui_lang)
        self._curr_conc_form_args = None

    def get_mapping_url_prefix(self):
        return super(Kontext, self).get_mapping_url_prefix()

    def add_conc_form_args(self, item):
        self._curr_conc_form_args = item

    def get_saveable_conc_data(self, prev_data):
        """
        Export data stored by conc_persistence
        """
        ans = super(Querying, self).get_saveable_conc_data(prev_data)

        if self._curr_conc_form_args is not None and self._curr_conc_form_args.is_persistent:
            ans.update(conc_forms_args=self._curr_conc_form_args.to_dict())
        return ans

    @staticmethod
    def import_qs(qs):
        """
        Import query selector value (e.g. 'iqueryrow')
        into a query type identifier (e.g. 'iquery').
        """
        return qs[:-3] if qs is not None else None

    def _select_current_aligned_corpora(self, active_only):
        return self._get_current_aligned_corpora() if active_only else self._get_available_aligned_corpora()

    def _attach_query_params(self, tpl_out):
        """
        Attach data required by client-side forms which are
        part of the current query pipeline (i.e. initial query, filters,
        sorting, samples,...)
        """
        corpus_info = self.get_corpus_info(self.args.corpname)
        tpl_out['metadata_desc'] = corpus_info['metadata']['desc']
        tpl_out['input_languages'] = {}
        tpl_out['input_languages'][self.args.corpname] = corpus_info['collator_locale']
        if self._prev_q_data is not None and 'conc_forms_args' in self._prev_q_data:
            op_key = self._prev_q_data['id']
            conc_forms_args = {
                op_key: build_conc_form_args(self._prev_q_data['conc_forms_args'], op_key).to_dict()
            }
        else:
            conc_forms_args = {}
        # Attach new form args added by the current action.
        if self._curr_conc_form_args is not None:
            conc_forms_args['__new__'] = self._curr_conc_form_args.to_dict()
        tpl_out['conc_forms_args'] = conc_forms_args

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

    @exposed(return_type='json', http_method='GET')
    def ajax_fetch_conc_form_args(self, request):
        pipeline = self._load_pipeline(request.args['last_key'])
        op_data = pipeline[int(request.args['idx'])]
        tmp = op_data.get('conc_forms_args', {})
        tmp.update(op_key=op_data['id'])
        return tmp

    @staticmethod
    def _load_pipeline(last_id):
        ans = []
        if plugins.has_plugin('conc_persistence'):
            cp = plugins.get('conc_persistence')
            data = cp.open(last_id)
            if data is not None:
                data['conc_forms_args'] = build_conc_form_args(data['conc_forms_args'], data['id']).to_dict()
                ans.append(data)
            limit = 100
            while data is not None and data.get('prev_id') and limit > 0:
                data = cp.open(data['prev_id'])
                data['conc_forms_args'] = build_conc_form_args(data['conc_forms_args'], data['id']).to_dict()
                ans.insert(0, data)
                limit -= 1
        return ans
