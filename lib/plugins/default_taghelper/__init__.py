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

import os

from translation import ugettext as _
from controller import exposed
from controller.errors import UserActionException
import plugins
from plugins.abstract.taghelper import AbstractTaghelper
from plugins.default_taghelper.loaders.positional import PositionalTagVariantLoader
from actions import corpora


@exposed(return_type='json')
def ajax_get_tag_variants(ctrl, request):
    """
    """
    pattern = request.args.get('pattern', '')
    try:
        tag_loader = plugins.runtime.TAGHELPER.instance.loader(ctrl.args.corpname)
    except IOError:
        raise UserActionException(
            _('Corpus %s is not supported by this widget.') % ctrl.args.corpname)

    if len(pattern) > 0:
        ans = tag_loader.get_variant(pattern, ctrl.ui_lang)
    else:
        ans = tag_loader.get_initial_values(ctrl.ui_lang)
    return ans


class TagHelperException(Exception):
    """
    General error for the module
    """
    pass


class Taghelper(AbstractTaghelper):

    def __init__(self, conf, corparch):
        self._conf = conf
        self._corparch = corparch
        self._loaders = {}

    def loader(self, corpus_name):
        tagset_name = self._corparch.get_corpus_info('en_US', corpus_name)['tagset']
        if corpus_name not in self._loaders:
            self._loaders[corpus_name] = PositionalTagVariantLoader(
                corpus_name=corpus_name, tagset_name=tagset_name,
                cache_dir=self._conf['default:tags_cache_dir'],
                variants_file_path=self.create_tag_variants_file_path(corpus_name),
                cache_clear_interval=self._conf['default:clear_interval'],
                taglist_path=self._conf['default:taglist_path'])
        return self._loaders[corpus_name]

    def create_tag_variants_file_path(self, corpus_name):
        """
        Generates a full path (full = as defined in the main configuration file)
        to the file which contains all the existing tag variants for the passed
        corpus name

        arguments:
        corpus_name -- str

        returns:
        a path to a specific cached file
        """
        if not corpus_name:
            raise TagHelperException('Empty corpus name')
        return os.path.join(self._conf['default:tags_src_dir'], corpus_name)

    def tags_enabled_for(self, corpus_name):
        """
        Tests whether the path to the provided corpus_name exists

        arguments:
        corpus_name -- str

        returns:
        a boolean value
        """
        if corpus_name:
            return (os.path.exists(self.create_tag_variants_file_path(corpus_name)) and
                    self.loader(corpus_name).is_enabled())
        return False

    def export_actions(self):
        return {corpora.Corpora: [ajax_get_tag_variants]}

    def export(self, plugin_api):
        info = self._corparch.get_corpus_info(
            plugin_api.user_lang, plugin_api.current_corpus.corpname)
        return dict(corp_tagset_info=dict(ident=info.tagset, type=info.tagset_type, attrs=('tag',)))


@plugins.inject(plugins.runtime.CORPARCH)
def create_instance(conf, corparch):
    """
    arguments:
    conf -- KonText's settings module or a compatible object
    """
    return Taghelper(conf.get('plugins', 'taghelper'), corparch)
