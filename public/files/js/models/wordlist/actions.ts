/*
 * Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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
import { IndexedResultItem, WlTypes, FileTarget, WordlistSubmitArgs } from './common';
import { FilterEditorData } from './form';
import * as Kontext from '../../types/kontext';
import { DataSaveFormat } from '../../app/navigation/save';


export class Actions {

    static WordlistResultViewConc:Action<{
        word:string;
    }> = {
        name: 'WORDLIST_RESULT_VIEW_CONC'
    };

    static WordlistResultReload:Action<{
    }> = {
        name: 'WORDLIST_RESULT_RELOAD'
    };

    static WordlistFormSubmitReady:Action<{
        args:WordlistSubmitArgs;
    }> = {
        name: 'WORDLIST_FORM_SUBMIT_READY'
    };

    static WordlistFormSubmit:Action<{
    }> = {
        name: 'WORDLIST_FORM_SUBMIT'
    };

    static WordlistFormSubmitCancelled:Action<{
    }> = {
        name: 'WORDLIST_FORM_SUBMIT_CANCELLED'
    };

    static WordlistResultNextPage:Action<{
    }> = {
        name: 'WORDLIST_RESULT_NEXT_PAGE'
    };

    static WordlistResultPrevPage:Action<{
    }> = {
        name: 'WORDLIST_RESULT_PREV_PAGE'
    };

    static WordlistResultSetPage:Action<{
        page:string;
    }> = {
        name: 'WORDLIST_RESULT_SET_PAGE'
    };

    static WordlistResultConfirmPage:Action<{
        page:string;
    }> = {
        name: 'WORDLIST_RESULT_CONFIRM_PAGE'
    };

    static WordlistGoToFirstPage:Action<{
    }> = {
        name: 'WORDLIST_GO_TO_FIRST_PAGE'
    };

    static WordlistPageLoadDone:Action<{
        page:number;
        sortColumn:{wlsort:string; reverse:boolean};
        data:Array<IndexedResultItem>;
    }> = {
        name: 'WORDLIST_PAGE_LOAD_DONE'
    };

    static WordlistFormSelectAttr:Action<{
        value:string;
    }> = {
        name: 'WORDLIST_FORM_SELECT_ATTR'
    };

    static WordlistFormSetWlpat:Action<{
        value:string;
    }> = {
        name: 'WORDLIST_FORM_SET_WLPAT'
    };

    static WordlistFormSetWlnums:Action<{
        value:string;
    }> = {
        name: 'WORDLIST_FORM_SET_WLNUMS'
    };

    static WordlistFormSelectWlposattr:Action<{
        ident:string;
        value:string;
    }> = {
        name: 'WORDLIST_FORM_SELECT_WLPOSATTR'
    };

    static WordlistFormSetWltype:Action<{
        value:WlTypes;
    }> = {
        name: 'WORDLIST_FORM_SET_WLTYPE'
    };

    static WordlistFormSetWlminfreq:Action<{
        value:string;
    }> = {
        name: 'WORDLIST_FORM_SET_WLMINFREQ'
    };

    static WordlistFormSetIncludeNonwords:Action<{
        value:boolean;
    }> = {
        name: 'WORDLIST_FORM_SET_INCLUDE_NONWORDS'
    };

    static WordlistFormAddPosattrLevel:Action<{
    }> = {
        name: 'WORDLIST_FORM_ADD_POSATTR_LEVEL'
    };

    static WordlistFormRemovePosattrLevel:Action<{
        ident:string;
    }> = {
        name: 'WORDLIST_FORM_REMOVE_POSATTR_LEVEL'
    };

    static WordlistFormCreatePfilter:Action<{

    }> = {
        name: 'WORDLIST_FORM_CREATE_PFILTER'
    };

    static WordlistFormCreateNfilter:Action<{

    }> = {
        name: 'WORDLIST_FORM_CREATE_NFILTER'
    };

    static WordlistFormSetFilter:Action<{
        value:File;
        target:FileTarget;
    }> = {
        name: 'WORDLIST_FORM_SET_FILTER_FILE'
    };

    static WordlistFormSetFilterDone:Action<{
        data:FilterEditorData;
    }> = {
        name: 'WORDLIST_FORM_SET_FILTER_FILE_DONE'
    };

    static WordlistFormUpdateEditor:Action<{
        value:string;
    }> = {
        name: 'WORDLIST_FORM_UPDATE_EDITOR'
    };

    static WordlistFormReopenEditor:Action<{
        target:FileTarget;
    }> = {
        name: 'WORDLIST_FORM_REOPEN_EDITOR'
    };

    static WordlistFormClearFilterFile:Action<{
        target:FileTarget;
    }> = {
        name: 'WORDLIST_FORM_CLEAR_FILTER_FILE'
    };

    static WordlistFormCloseEditor:Action<{
    }> = {
        name: 'WORDLIST_FORM_CLOSE_EDITOR'
    };

    static WordlistResultSetSortColumn:Action<{
        sortKey:string;
        reverse:boolean;
    }> = {
        name: 'WORDLIST_RESULT_SET_SORT_COLUMN'
    };

    static WordlistGoToLastPage:Action<{
    }> = {
        name: 'WORDLIST_GO_TO_LAST_PAGE'
    };

    static WordlistSaveFormHide:Action<{
    }> = {
        name: 'WORDLIST_SAVE_FORM_HIDE'
    };

    static WordlistSaveFormSetMaxLine:Action<{
        value:string;
    }> = {
        name: 'WORDLIST_SAVE_FORM_SET_MAX_LINE'
    };

    static WordlistSaveFormSetFormat:Action<{
        value:DataSaveFormat;
    }> = {
        name: 'WORDLIST_SAVE_FORM_SET_FORMAT'
    };

    static WordlistSaveSetIncludeHeading:Action<{
        value:boolean;
    }> = {
        name: 'WORDLIST_SAVE_SET_INCLUDE_HEADING'
    };

    static WordlistSaveSetIncludeColHeaders:Action<{
        value:boolean;
    }> = {
        name: 'WORDLIST_SAVE_SET_INCLUDE_COL_HEADERS'
    };

    static WordlistSaveFormSubmit:Action<{
    }> = {
        name: 'WORDLIST_SAVE_FORM_SUBMIT'
    };

    static WordlistSaveFormSubmitDone:Action<{
    }> = {
        name: 'WORDLIST_SAVE_FORM_SUBMIT_DONE'
    };

    static WordlistHistoryPopState:Action<{
        q:string;
        wlpage:number;
        wlsort:string;
        reverse:boolean;
    }> = {
        name: 'WORDLIST_HISTORY_POP_STATE'
    };

    static WordlistIntermediateBgCalcUpdated:Action<{
        status:number;
    }> = {
        name: 'WORDLIST_INTERMEDIATE_BG_CALC_UPDATED'
    };

    static ToggleOutputOptions:Action<{
    }> = {
        name: 'WORDLIST_TOGGLE_OUTPUT_OPTIONS'
    };

    static ToggleFilterOptions:Action<{
    }> = {
        name: 'WORDLIST_TOGGLE_FILTER_OPTIONS'
    };

    static RegisterPrecalcTasks:Action<{
        tasks:Array<Kontext.AsyncTaskInfo<{}>>;
    }> = {
        name: 'WORDLIST_REGISTER_PRECALC_TASKS'
    };

    static ToggleModalForm:Action<{
    }> = {
        name: 'WORDLIST_TOGGLE_MODAL_FORM'
    };
}