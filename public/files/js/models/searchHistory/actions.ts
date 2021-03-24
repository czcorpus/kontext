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
import { Kontext } from '../../types/common';
import { QueryFormType } from '../query/actions';


export enum ActionName {

    HistorySetQuerySupertype = 'QUERY_HISTORY_SET_QUERY_SUPERTYPE',
    HistorySetCurrentCorpusOnly = 'QUERY_HISTORY_SET_CURRENT_CORPUS_ONLY',
    HistorySetArchivedOnly = 'QUERY_HISTORY_SET_ARCHIVED_ONLY',
    HistorySetEditedItem = 'QUERY_HISTORY_SET_EDITED_ITEM',
    HistoryDoNotArchive = 'QUERY_HISTORY_DO_NOT_ARCHIVE',
    HistoryEditorSetName = 'QUERY_HISTORY_EDITOR_SET_NAME',
    HistoryEditorClickSave = 'QUERY_HISTORY_EDITOR_CLICK_SAVE',
    HistoryCloseEditedItem = 'QUERY_HISTORY_CLOSE_EDITED_ITEM',
    HistoryOpenQueryForm = 'QUERY_HISTORY_OPEN_QUERY_FORM',
    HistoryLoadMore = 'QUERY_HISTORY_LOAD_MORE',
    SelectItem = 'QUERY_HISTORY_SELECT_CURRENT_ITEM',
    ToggleQueryHistoryWidget = 'QUERY_INPUT_TOGGLE_QUERY_HISTORY_WIDGET'
}


export namespace Actions {

    export interface HistorySetQuerySupertype extends Action<{
        value:Kontext.QuerySupertype;
    }> {
        name:ActionName.HistorySetQuerySupertype;
    }

    export interface HistorySetCurrentCorpusOnly extends Action<{
        value:boolean;
    }> {
        name:ActionName.HistorySetCurrentCorpusOnly;
    }

    export interface HistorySetArchivedOnly extends Action<{
        value:boolean;
    }> {
        name:ActionName.HistorySetArchivedOnly;
    }

    export interface HistorySetEditedItem extends Action<{
        itemIdx:number;
    }> {
        name:ActionName.HistorySetEditedItem;
    }

    export interface HistoryDoNotArchive extends Action<{
        itemIdx:number;
    }> {
        name:ActionName.HistoryDoNotArchive;
    }

    export interface HistoryEditorSetName extends Action<{
        value:string;
    }> {
        name:ActionName.HistoryEditorSetName;
    }

    export interface HistoryEditorClickSave extends Action<{
    }> {
        name:ActionName.HistoryEditorClickSave;
    }

    export interface HistoryCloseEditedItem extends Action<{
    }> {
        name:ActionName.HistoryCloseEditedItem;
    }

    export interface HistoryOpenQueryForm extends Action<{
        idx:number;
    }> {
        name:ActionName.HistoryOpenQueryForm;
    }

    export interface HistoryLoadMore extends Action<{
    }> {
        name:ActionName.HistoryLoadMore;
    }

    export interface SelectItem extends Action<{
        value:number;
    }> {
        name:ActionName.SelectItem;
    }

    export interface ToggleQueryHistoryWidget extends Action<{
        formType:QueryFormType;
        sourceId:string;
    }> {
        name:ActionName.ToggleQueryHistoryWidget;
    }

}