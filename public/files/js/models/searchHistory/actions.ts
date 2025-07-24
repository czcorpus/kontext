/*
 * Copyright (c) 2020 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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
import * as Kontext from '../../types/kontext.js';
import { QueryFormType } from '../query/actions.js';


export class Actions {

    static HistorySetQuerySupertype:Action<{
        value:Kontext.QuerySupertype;
    }> = {
        name: 'QUERY_HISTORY_SET_QUERY_SUPERTYPE'
    };

    static HistorySetCurrentCorpusOnly:Action<{
        value:boolean;
    }> = {
        name: 'QUERY_HISTORY_SET_CURRENT_CORPUS_ONLY'
    };

    static HistorySetArchivedOnly:Action<{
        value:boolean;
    }> = {
        name: 'QUERY_HISTORY_SET_ARCHIVED_ONLY'
    };

    static HistorySetArchivedAs:Action<{
        value:string;
    }> = {
        name: 'QUERY_HISTORY_SET_ARCHIVED_AS'
    };

    static HistorySetEditedItem:Action<{
        itemIdx:number;
    }> = {
        name: 'QUERY_HISTORY_SET_EDITED_ITEM'
    };

    static HistoryDoNotArchive:Action<{
        itemIdx:number;
    }> = {
        name: 'QUERY_HISTORY_DO_NOT_ARCHIVE'
    };

    static HistoryEditorSetName:Action<{
        itemIdx:number;
        value:string;
    }> = {
        name: 'QUERY_HISTORY_EDITOR_SET_NAME'
    };

    static HistoryEditorClickSave:Action<{
        itemIdx:number;
    }> = {
        name: 'QUERY_HISTORY_EDITOR_CLICK_SAVE'
    };

    static HistoryCloseEditedItem:Action<{
        itemIdx:number;
    }> = {
        name: 'QUERY_HISTORY_CLOSE_EDITED_ITEM'
    };

    static HistoryOpenQueryForm:Action<{
        idx:number;
    }> = {
        name: 'QUERY_HISTORY_OPEN_QUERY_FORM'
    };

    static HistoryLoadMore:Action<{
    }> = {
        name: 'QUERY_HISTORY_LOAD_MORE'
    };

    static SelectItem:Action<{
        value:number;
    }> = {
        name: 'QUERY_HISTORY_SELECT_CURRENT_ITEM'
    };

    static ToggleQueryHistoryWidget:Action<{
        formType:QueryFormType;
        sourceId:string;
        querySupertype?:Kontext.QuerySupertype
    }> = {
        name: 'QUERY_INPUT_TOGGLE_QUERY_HISTORY_WIDGET'
    };

    static ToggleRowToolbar:Action<{
        rowIdx:number;
    }> = {
        name: 'QUERY_HISTORY_TOGGLE_ROW_TOOLBAR'
    };

    static RemoveItemFromList:Action<{
        itemIdx:number;
    }> = {
        name: 'QUERY_HISTORY_REMOVE_ITEM_FROM_LIST'
    };

    static RemoveItemFromListDone:Action<{
        itemIdx:number;
    }> = {
        name: 'QUERY_HISTORY_REMOVE_ITEM_FROM_LIST_DONE'
    };

    static ChangeSearchForm:Action<{
        value:'extended'|'quick';
    }> = {
        name: 'QUERY_HISTORY_CHANGE_SEARCH_FORM'
    };

    static SetFsPosattrName:Action<{
        value:string;
    }> = {
        name: 'QUERY_HISTORY_SET_FS_POSATTR_NAME'
    };

    static SetFsPosattrValue:Action<{
        value:string;
    }> = {
        name: 'QUERY_HISTORY_SET_FS_POSATTR_VALUE'
    };

    static SetFsPosattrValueIsSub:Action<{
        value:boolean;
    }> = {
        name: 'QUERY_HISTORY_SET_FS_POSATTR_VALUE_IS_SUB'
    };

    static SetFsStructureName:Action<{
        value:string;
    }> = {
        name: 'QUERY_HISTORY_SET_FS_STRUCTURE_NAME'
    };

    static SetFsStructattrName:Action<{
        value:string;
    }> = {
        name: 'QUERY_HISTORY_SET_FS_STRUCTATTR_NAME'
    };

    static SetFsStructattrValue:Action<{
        value:string;
    }> = {
        name: 'QUERY_HISTORY_SET_FS_STRUCTATTR_VALUE'
    };

    static SetFsStructattrValueIsSub:Action<{
        value:boolean;
    }> = {
        name: 'QUERY_HISTORY_SET_FS_STRUCTATTR_VALUE_IS_SUB'
    };

    static SetFsAnyPropertyValue:Action<{
        value:string;
    }> = {
        name: 'QUERY_HISTORY_SET_FS_ANY_PROPERTY_VALUE'
    };

    static SetFsAnyPropertyValueIsSub:Action<{
        value:boolean;
    }> = {
        name: 'QUERY_HISTORY_SET_FS_ANY_PROPERTY_VALUE_IS_SUB'
    };

    static SetFsAdvancedQuery:Action<{
        value:boolean;
    }> = {
        name: 'QUERY_HISTORY_SET_FS_ADVANCED_QUERY'
    };

    static SetFsSubcorpus:Action<{
        value:string;
    }> = {
        name: 'QUERY_HISTORY_SET_FS_SUBCORPUS'
    };

    static SetFsCorpus:Action<{
        value:string;
    }> = {
        name: 'QUERY_HISTORY_SET_FS_CORPUS'
    };

    static SetFsWlpat:Action<{
        value:string;
    }> = {
        name: 'QUERY_HISTORY_SET_FS_WLPAT'
    };

    static SetFsWlattr:Action<{
        value:string;
    }> = {
        name: 'QUERY_HISTORY_SET_FS_WLATTR'
    };

    static SetFsPFilter:Action<{
        value:string;
    }> = {
        name: 'QUERY_HISTORY_SET_FS_PFILTER'
    };

    static SetFsNFilter:Action<{
        value:string;
    }> = {
        name: 'QUERY_HISTORY_SET_FS_NFILTER'
    };

    static SubmitExtendedSearch:Action<{
    }> = {
        name: 'QUERY_HISTORY_SUBMIT_EXTENDED_SEARCH'
    };

    static ToggleHelpView:Action<{
    }> = {
        name: 'QUERY_HISTORY_TOGGLE_HELP_VIEW'
    };

}
