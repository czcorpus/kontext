# Copyright (c) 2012 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2012 Tomas Machalek <tomas.machalek@gmail.com>
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

"""
A 'taghelper' plug-in implementation. It provides a data-driven, interactive way
how to create a tag query. Please note that this works only with tag formats with
fixed positions for defined categories (e.g.: part of speech = character 0,
gender = character 1, case = character 2,...)

Please note that this module requires a proper Corptree plug-in configuration and data.

Required XML:

element taghelper {
  element module { "default_taghelper" }
  element clear_interval {
    attribute extension-by { "default" }
    text # TTL - number of seconds
  }
  element tags_cache_dir {
    attribute extension-by { "default" }
    text #  a path to a dir where files are cached
  }
}
"""
from translation import ugettext as _
from controller import exposed
from controller.errors import UserActionException
import plugins
from plugins.abstract.taghelper import AbstractTaghelper
from plugins.default_taghelper.loaders.positional import PositionalTagVariantLoader
from plugins.default_taghelper.loaders.keyval import KeyvalTagVariantLoader
from plugins.default_taghelper.loaders import NullTagVariantLoader
from plugins.default_taghelper.fetchers.keyval import KeyvalSelectionFetcher
from plugins.default_taghelper.fetchers.positional import PositionalSelectionFetcher
from plugins.default_taghelper.fetchers import NullSelectionFetcher
from actions import corpora


@exposed(return_type='json')
def ajax_get_tag_variants(ctrl, request):
    """
    """
    corpname = request.args['corpname']
    tagset_name = request.args['tagset']
    values_selection = plugins.runtime.TAGHELPER.instance.fetcher(
        corpname, tagset_name).fetch(request)
    try:
        tag_loader = plugins.runtime.TAGHELPER.instance.loader(corpname, tagset_name)
    except IOError:
        raise UserActionException(
            _('Corpus %s is not supported by this widget.') % corpname)
    if plugins.runtime.TAGHELPER.instance.fetcher(corpname, tagset_name).is_empty(values_selection):
        ans = tag_loader.get_initial_values(ctrl.ui_lang)
    else:
        ans = tag_loader.get_variant(values_selection, ctrl.ui_lang)
    return ans


class Taghelper(AbstractTaghelper):

    def __init__(self, conf, corparch):
        self._conf = conf
        self._corparch = corparch
        self._loaders = {}
        self._fetchers = {}

    def loader(self, corpus_name, tagset_name):
        if (corpus_name, tagset_name) not in self._loaders:
            for tagset in self._corparch.get_corpus_info('en_US', corpus_name).tagsets:
                if tagset.tagset_type == 'positional':
                    self._loaders[(corpus_name, tagset.tagset_name)] = PositionalTagVariantLoader(
                        corpus_name=corpus_name, tagset_name=tagset.tagset_name,
                        cache_dir=self._conf['default:tags_cache_dir'],
                        tags_src_dir=self._conf['default:tags_src_dir'],
                        cache_clear_interval=self._conf['default:clear_interval'],
                        taglist_path=self._conf['default:taglist_path'])
                    self._fetchers[(corpus_name, tagset.tagset_name)] = PositionalSelectionFetcher()
                elif tagset.tagset_type == 'keyval':
                    self._loaders[(corpus_name, tagset.tagset_name)] = KeyvalTagVariantLoader(
                        corpus_name=corpus_name, tagset_name=tagset.tagset_name,
                        tags_src_dir=self._conf['default:tags_src_dir'],
                    )
                    self._fetchers[(corpus_name, tagset.tagset_name)] = KeyvalSelectionFetcher()
                else:
                    self._loaders[(corpus_name, tagset.tagset_name)] = NullTagVariantLoader()
                    self._fetchers[(corpus_name, tagset.tagset_name)] = NullSelectionFetcher()
        return self._loaders[(corpus_name, tagset_name)]

    def fetcher(self, corpus_name, tagset_name):
        if (corpus_name, tagset_name) not in self._fetchers:
            for tagset in self._corparch.get_corpus_info('en_US', corpus_name).tagsets:
                if tagset.tagset_type == 'positional':
                    self._fetchers[(corpus_name, tagset.tagset_name)] = PositionalSelectionFetcher()
                elif tagset.tagset_type == 'keyval':
                    self._fetchers[(corpus_name, tagset.tagset_name)] = KeyvalSelectionFetcher()
                else:
                    self._fetchers[(corpus_name, tagset.tagset_name)] = NullSelectionFetcher()
        return self._fetchers[(corpus_name, tagset_name)]

    def tags_enabled_for(self, corpus_name):
        for tagset in self._corparch.get_corpus_info('en_US', corpus_name).tagsets:
            loader = self.loader(corpus_name, tagset.tagset_name)
            if loader.is_enabled():
                return True
        return False

    def export_actions(self):
        return {corpora.Corpora: [ajax_get_tag_variants]}

    def export(self, plugin_api):
        tagsets = {}
        for corp in ([plugin_api.current_corpus.corpname] + plugin_api.available_aligned_corpora):
            info = self._corparch.get_corpus_info(
                plugin_api.user_lang, corp)
            for tagset in info.tagsets:
                tagsets[tagset.tagset_name] = tagset
        return dict(corp_tagsets=[x.to_dict() for x in tagsets.values()])


@plugins.inject(plugins.runtime.CORPARCH)
def create_instance(conf, corparch):
    """
    arguments:
    conf -- KonText's settings module or a compatible object
    """
    return Taghelper(conf.get('plugins', 'taghelper'), corparch)
