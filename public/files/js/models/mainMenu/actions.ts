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
import { SaveData } from '../../app/navigation';
import { Kontext } from '../../types/common';

export enum ActionName {
    SetVisibleSubmenu = 'MAIN_MENU_SET_VISIBLE_SUBMENU',
    ClearVisibleSubmenu = 'MAIN_MENU_CLEAR_VISIBLE_SUBMENU',
    ClearActiveItem = 'MAIN_MENU_CLEAR_ACTIVE_ITEM',
    ShowSort = 'MAIN_MENU_SHOW_SORT',
    ApplyShuffle = 'MAIN_MENU_APPLY_SHUFFLE',
    ShowSample = 'MAIN_MENU_SHOW_SAMPLE',
    OverviewShowQueryInfo = 'MAIN_MENU_OVERVIEW_SHOW_QUERY_INFO',
    OverviewShowQueryInfoDone = 'MAIN_MENU_OVERVIEW_SHOW_QUERY_INFO_DONE',
    ShowSaveQueryAsForm = 'MAIN_MENU_SHOW_SAVE_QUERY_AS_FORM',
    MakeConcLinkPersistent = 'MAIN_MENU_MAKE_CONC_LINK_PERSISTENT',
    UndoLastQueryOp = 'MAIN_MENU_UNDO_LAST_QUERY_OP',
    ShowFilter = 'MAIN_MENU_SHOW_FILTER',
    FilterApplySubhitsRemove = 'MAIN_MENU_FILTER_APPLY_SUBHITS_REMOVE',
    FilterApplyFirstOccurrences = 'MAIN_MENU_FILTER_APPLY_FIRST_OCCURRENCES',
    ShowFreqForm = 'MAIN_MENU_SHOW_FREQ_FORM',
    ShowCollForm = 'MAIN_MENU_SHOW_COLL_FORM',
    ShowAttrsViewOptions = 'MAIN_MENU_SHOW_ATTRS_VIEW_OPTIONS',
    ShowGeneralViewOptions = 'MAIN_MENU_SHOW_GENERAL_VIEW_OPTIONS',
    ShowCitationInfo = 'OVERVIEW_SHOW_CITATION_INFO',
    ShowKeyShortcuts = 'OVERVIEW_SHOW_KEY_SHORTCUTS',
    ShowSaveForm = 'MAIN_MENU_SHOW_SAVE_FORM',
    DirectSave = 'MAIN_MENU_DIRECT_SAVE',
    ShowSwitchMc = 'MAIN_MENU_SHOW_SWITCHMC',
    ShowQueryHistory = 'MAIN_MENU_SHOW_QUERY_HISTORY',
}


export namespace Actions {

    export interface SetVisibleSubmenu extends Action<{
        value:string;
    }> {
        name: ActionName.SetVisibleSubmenu;
    }

    export interface ClearVisibleSubmenu extends Action<{
    }> {
        name: ActionName.ClearVisibleSubmenu;
    }

    export interface ClearActiveItem extends Action<{
    }> {
        name: ActionName.ClearActiveItem;
    }

    export interface ShowSort extends Action<{
    }> {
        name: ActionName.ShowSort;
    }

    export interface ApplyShuffle extends Action<{
    }> {
        name: ActionName.ApplyShuffle;
    }

    export interface ShowSample extends Action<{
    }> {
        name: ActionName.ShowSample;
    }

    export interface OverviewShowQueryInfo extends Action<{
    }> {
        name: ActionName.OverviewShowQueryInfo;
    }

    export interface OverviewShowQueryInfoDone extends Action<{
        Desc:Array<Kontext.QueryOperation>;
    }> {
        name: ActionName.OverviewShowQueryInfoDone;
    }

    export interface ShowSaveQueryAsForm extends Action<{
    }> {
        name: ActionName.ShowSaveQueryAsForm;
    }

    export interface MakeConcLinkPersistent extends Action<{
    }> {
        name: ActionName.MakeConcLinkPersistent;
    }

    export interface UndoLastQueryOp extends Action<{
    }> {
        name: ActionName.UndoLastQueryOp;
    }

    export interface ShowFilter extends Action<{
        within:boolean;
        maincorp:string;
        pnfilter?:'p'|'n';
    }> {
        name: ActionName.ShowFilter;
    }

    export interface FilterApplySubhitsRemove extends Action<{
    }> {
        name: ActionName.FilterApplySubhitsRemove;
    }

    export interface FilterApplyFirstOccurrences extends Action<{
    }> {
        name: ActionName.FilterApplyFirstOccurrences;
    }

    export interface ShowFreqForm extends Action<{
    }> {
        name: ActionName.ShowFreqForm;
    }

    export interface ShowCollForm extends Action<{
    }> {
        name: ActionName.ShowCollForm;
    }

    export interface ShowAttrsViewOptions extends Action<{
    }> {
        name: ActionName.ShowAttrsViewOptions;
    }

    export interface ShowGeneralViewOptions extends Action<{
    }> {
        name: ActionName.ShowGeneralViewOptions;
    }

    export interface ShowCitationInfo extends Action<{
    }> {
        name: ActionName.ShowCitationInfo;
    }

    export interface ShowKeyShortcuts extends Action<{
    }> {
        name: ActionName.ShowKeyShortcuts;
    }

    export interface ShowSaveForm extends Action<{
    }> {
        name: ActionName.ShowSaveForm;
    }

    export interface DirectSave extends Action<{
        saveformat:SaveData.Format;
    }> {
        name: ActionName.DirectSave;
    }

    export interface ShowSwitchMc extends Action<{
    }> {
        name: ActionName.ShowSwitchMc;
    }

    export interface ShowQueryHistory extends Action<{
    }> {
        name: ActionName.ShowQueryHistory;
    }

}