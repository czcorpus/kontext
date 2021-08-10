/*
 * Copyright (c) 2020 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2020 Tomas Machalek <tomas.machalek@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; version 2
 * dated June, 1991.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

import { Action } from 'kombo';
import { DataSaveFormat } from '../../app/navigation/save';
import * as Kontext from '../../types/kontext';


export class Actions {

    static SetVisibleSubmenu:Action<{
        value:string;
    }> = {
        name: 'MAIN_MENU_SET_VISIBLE_SUBMENU'
    }

    static ClearVisibleSubmenu:Action<{
    }> = {
        name: 'MAIN_MENU_CLEAR_VISIBLE_SUBMENU'
    }

    static ClearActiveItem:Action<{
    }> = {
        name: 'MAIN_MENU_CLEAR_ACTIVE_ITEM'
    }

    static ShowSort:Action<{
    }> = {
        name: 'MAIN_MENU_SHOW_SORT'
    }

    static ApplyShuffle:Action<{
    }> = {
        name: 'MAIN_MENU_APPLY_SHUFFLE'
    }

    static ShowSample:Action<{
    }> = {
        name: 'MAIN_MENU_SHOW_SAMPLE'
    }

    static OverviewShowQueryInfo:Action<{
    }> = {
        name: 'MAIN_MENU_OVERVIEW_SHOW_QUERY_INFO'
    }

    static OverviewShowQueryInfoDone:Action<{
        Desc:Array<Kontext.QueryOperation>;
    }> = {
        name: 'MAIN_MENU_OVERVIEW_SHOW_QUERY_INFO_DONE'
    }

    static ShowSaveQueryAsForm:Action<{
    }> = {
        name: 'MAIN_MENU_SHOW_SAVE_QUERY_AS_FORM'
    }

    static MakeConcLinkPersistent:Action<{
    }> = {
        name: 'MAIN_MENU_MAKE_CONC_LINK_PERSISTENT'
    }

    static UndoLastQueryOp:Action<{
    }> = {
        name: 'MAIN_MENU_UNDO_LAST_QUERY_OP'
    }

    static ShowFilter:Action<{
        within:boolean;
        maincorp:string;
        pnfilter?:'p'|'n';
    }> = {
        name: 'MAIN_MENU_SHOW_FILTER'
    }

    static FilterApplySubhitsRemove:Action<{
    }> = {
        name: 'MAIN_MENU_FILTER_APPLY_SUBHITS_REMOVE'
    }

    static FilterApplyFirstOccurrences:Action<{
    }> = {
        name: 'MAIN_MENU_FILTER_APPLY_FIRST_OCCURRENCES'
    }

    static ShowFreqForm:Action<{
    }> = {
        name: 'MAIN_MENU_SHOW_FREQ_FORM'
    }

    static ShowCollForm:Action<{
    }> = {
        name: 'MAIN_MENU_SHOW_COLL_FORM'
    }

    static ShowAttrsViewOptions:Action<{
    }> = {
        name: 'MAIN_MENU_SHOW_ATTRS_VIEW_OPTIONS'
    }

    static ShowGeneralViewOptions:Action<{
    }> = {
        name: 'MAIN_MENU_SHOW_GENERAL_VIEW_OPTIONS'
    }

    static ShowCitationInfo:Action<{
    }> = {
        name: 'OVERVIEW_SHOW_CITATION_INFO'
    }

    static ShowKeyShortcuts:Action<{
    }> = {
        name: 'OVERVIEW_SHOW_KEY_SHORTCUTS'
    }

    static ShowSaveForm:Action<{
    }> = {
        name: 'MAIN_MENU_SHOW_SAVE_FORM'
    }

    static DirectSave:Action<{
        saveformat:DataSaveFormat;
    }> = {
        name: 'MAIN_MENU_DIRECT_SAVE'
    }

    static ShowSwitchMc:Action<{
    }> = {
        name: 'MAIN_MENU_SHOW_SWITCHMC'
    }

    static ShowQueryHistory:Action<{
    }> = {
        name: 'MAIN_MENU_SHOW_QUERY_HISTORY'
    }

    /**
     * note: in case submenuId is not specified
     * the whole section should be disabled/enabled
     */
    static ToggleDisabled:Action<{
        menuId:string;
        submenuId?:string;
        disabled:boolean;

    }> = {
        name: 'MAIN_MENU_TOGGLE_DISABLED'
    }
}