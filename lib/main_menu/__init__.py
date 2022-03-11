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

from dataclasses import fields, Field
from typing import Tuple, Dict, Any, Optional, Callable, List, Union

from action.argmapping import Args
import plugins
from action.plugin.ctx import PluginCtx
from .model import OutData, MainMenu, MainMenuItemId, AbstractMenuItem
from .submenus import (
    NewQuery, Corpora, Save, ConcordanceDefault, ConcordancePquery, Filter, Frequency, Collocations, View, Help)


def generate_main_menu(
    tpl_data: Dict[str, Any],
    args: Args,
    disabled_items: Union[List[MainMenuItemId], Tuple[MainMenuItemId, ...]],
    dynamic_items: List[AbstractMenuItem],
    corpus_dependent: bool,
    plugin_ctx: PluginCtx,
):
    """
    Generate main menu data based
    """

    merged_args = OutData(tpl_data, args)

    def modify_corpora(item: Corpora) -> Corpora:
        with plugins.runtime.CORPARCH as corparch:
            corparch.mod_corplist_menu(plugin_ctx, item.avail_corpora)
        return item

    def modify_save_items(save_item: Save) -> Save:
        for d_item in dynamic_items:
            if d_item.ident == MainMenu.SAVE:
                save_item.save_items.append(d_item)
        return save_item

    def modify_concordance(conc_item: ConcordanceDefault) -> Union[ConcordanceDefault, ConcordancePquery]:
        curr_action = merged_args.get('current_action', None)
        if curr_action == 'pquery/result':
            conc_item2 = ConcordancePquery()
            for d_item in dynamic_items:
                if d_item.ident == MainMenu.CONCORDANCE:
                    conc_item2.concordances.append(d_item)
            return conc_item2
        return conc_item

    def is_disabled(menu_item):
        if isinstance(menu_item, MainMenuItemId):
            item_id = menu_item
            item = None
        elif isinstance(menu_item, AbstractMenuItem):
            item_id = menu_item.ident
            item = menu_item
        else:
            raise ValueError()
        if corpus_dependent is False and item is not None and item.corpus_dependent is True:
            return True
        for item in disabled_items:
            if item_id.matches(item):
                return True
        return False

    def custom_menu_items(section):
        return [item.to_dict()
                for item in plugins.runtime.MENU_ITEMS.instance.get_items(section.name, lang=plugin_ctx.user_lang)]

    def exp(section, submenu, runtime_upd: Optional[Callable] = None):
        ans = []
        submenu_inst = submenu()
        if callable(runtime_upd):
            submenu_inst = runtime_upd(submenu_inst)
        smitems: Tuple[Field, ...] = fields(submenu_inst)
        for item in smitems:
            value = getattr(submenu_inst, item.name)
            if callable(value):
                value = value(merged_args)
            values = value if type(value) is list else [value]
            for value in values:
                if not value:
                    continue
                ans.append(value.filter_empty_args().set_disabled(
                    is_disabled(value)).create(merged_args, plugin_ctx.translate))
        return tuple(ans + custom_menu_items(section))

    items = [
        (MainMenu.NEW_QUERY.name, dict(
            label=plugin_ctx.translate('Query'),
            fallback_action='query',
            items=exp(MainMenu.NEW_QUERY, NewQuery),
            disabled=is_disabled(MainMenu.NEW_QUERY)
        )),
        (MainMenu.CORPORA.name, dict(
            label=plugin_ctx.translate('Corpora'),
            fallback_action='corpora/corplist',
            items=exp(MainMenu.CORPORA, Corpora, modify_corpora),
            disabled=is_disabled(MainMenu.CORPORA)
        )),
        (MainMenu.SAVE.name, dict(
            label=plugin_ctx.translate('Save'),
            items=exp(MainMenu.SAVE, Save, modify_save_items),
            disabled=is_disabled(MainMenu.SAVE)
        )),
        (MainMenu.CONCORDANCE.name, dict(
            label=plugin_ctx.translate('Concordance'),
            items=exp(MainMenu.CONCORDANCE, ConcordanceDefault, modify_concordance),
            disabled=is_disabled(MainMenu.CONCORDANCE)
        )),
        (MainMenu.FILTER.name, dict(
            label=plugin_ctx.translate('Filter'),
            items=exp(MainMenu.FILTER, Filter),
            disabled=is_disabled(MainMenu.FILTER)
        )),
        (MainMenu.FREQUENCY.name, dict(
            label=plugin_ctx.translate('Frequency'),
            items=exp(MainMenu.FREQUENCY, Frequency),
            disabled=is_disabled(MainMenu.FREQUENCY)
        )),
        (MainMenu.COLLOCATIONS.name, dict(
            label=plugin_ctx.translate('Collocations'),
            items=exp(MainMenu.COLLOCATIONS, Collocations),
            disabled=is_disabled(MainMenu.COLLOCATIONS)
        )),
        (MainMenu.VIEW.name, dict(
            label=plugin_ctx.translate('View'),
            items=exp(MainMenu.VIEW, View),
            disabled=is_disabled(MainMenu.VIEW)
        )),
        (MainMenu.HELP.name, dict(
            label=plugin_ctx.translate('Help'),
            items=exp(MainMenu.HELP, Help),
            disabled=is_disabled(MainMenu.HELP)
        ))
    ]
    return dict(submenuItems=items)
