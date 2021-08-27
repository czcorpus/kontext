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
import { AjaxResponse, CollSaveServerArgs, CollServerArgs, HistoryState } from './common';
import { ConcQuickFilterServerArgs } from '../concordance/common';
import { DataSaveFormat } from '../../app/navigation/save';


export class Actions {

    static ResultSetPageInputVal:Action<{
        value:string;
    }> = {
        name: 'COLL_RESULT_SET_PAGE_INPUT_VAL'
    };

    static ResultGetNextPage:Action<{}> = {
        name: 'COLL_RESULT_GET_NEXT_PAGE'
    };

    static ResultGetPrevPage:Action<{}> = {
        name: 'COLL_RESULT_GET_PREV_PAGE'
    };

    static ResultConfirmPageValue:Action<{}> = {
        name: 'COLL_RESULT_CONFIRM_PAGE_VALUE'
    };

    static ResultPageLoadDone:Action<{
        response:AjaxResponse;
    }> = {
        name: 'COLL_RESULT_PAGE_LOAD_DONE'
    };

    static ResultSortByColumn:Action<{
        sortFn:string;
    }> = {
        name: 'COLL_RESULT_SORT_BY_COLUMN'
    };

    static ResultApplyQuickFilter:Action<{
        args:ConcQuickFilterServerArgs;
        blankWindow:boolean;
    }> = {
        name: 'COLL_RESULT_APPLY_QUICK_FILTER'
    };

    static ResultUpdateCalculation:Action<{
        calcStatus:number;
    }> = {
        name: 'COLL_RESULT_UPDATE_CALCULATION'
    };

    static ResultCloseSaveForm:Action<{}> = {
        name: 'COLL_RESULT_CLOSE_SAVE_FORM'
    };

    static ResultReload:Action<{}> = {
        name: 'COLL_RESULT_RELOAD'
    };

    static FormSetCattr:Action<{
        value:string;
    }> = {
        name: 'COLL_FORM_SET_CATTR'
    };

    static FormSetCfromw:Action<{
        value:string;
    }> = {
        name: 'COLL_FORM_SET_CFROMW'
    };

    static FormSetCtow:Action<{
        value:string;
    }> = {
        name: 'COLL_FORM_SET_CTOW'
    };

    static FormSetCminFreq:Action<{
        value:string;
    }> = {
        name: 'COLL_FORM_SET_CMINFREQ'
    };

    static FormSetCminbgr:Action<{
        value:string;
    }> = {
        name: 'COLL_FORM_SET_CMINBGR'
    };

    static FormSetCbgrfns:Action<{
        value:string;
    }> = {
        name: 'COLL_FORM_SET_CBGRFNS'
    };

    static FormSetCsortfn:Action<{
        value:string;
    }> = {
        name: 'COLL_FORM_SET_CSORTFN'
    };

    static FormPrepareSubmitArgsDone:Action<{
        args:CollServerArgs;
    }> = {
        name: 'COLL_FORM_PREPARE_SUBMIT_ARGS_DONE'
    };

    static FormSubmit:Action<{}> = {
        name: 'COLL_FORM_SUBMIT'
    };

    static SaveFormSetFormat:Action<{
        value:DataSaveFormat;
    }> = {
        name: 'COLL_SAVE_FORM_SET_FORMAT'
    };

    static SaveFormSetFromLine:Action<{
        value:string;
    }> = {
        name: 'COLL_SAVE_FORM_SET_FROM_LINE'
    };

    static SaveFormSetToLine:Action<{
        value:string;
    }> = {
        name: 'COLL_SAVE_FORM_SET_TO_LINE'
    };

    static SaveFormSetIncludeColHeaders:Action<{
        value:boolean;
    }> = {
        name: 'COLL_SAVE_FORM_SET_INCLUDE_COL_HEADERS'
    };

    static SaveFormSetIncludeHeading:Action<{
        value:boolean;
    }> = {
        name: 'COLL_SAVE_FORM_SET_INCLUDE_HEADING'
    };

    static SaveFormSubmit:Action<{}> = {
        name: 'COLL_SAVE_FORM_SUBMIT'
    };

    static SaveFormSubmitDone:Action<{}> = {
        name: 'COLL_SAVE_FORM_SUBMIT_DONE'
    };

    static StatePushToHistory:Action<CollServerArgs> = {
        name: 'COLL_STATE_PUSH_TO_HISTORY'
    };

    static PopHistory:Action<HistoryState> = {
        name: 'COLL_POP_HISTORY'
    };
}