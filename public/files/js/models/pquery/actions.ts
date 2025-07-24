/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
 *                    Department of Linguistics
 * Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
 * Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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
import { AlignTypes } from '../freqs/twoDimension/common.js';
import { AsyncTaskArgs, HistoryArgs, PqueryAlignTypes } from './common.js';
import { SortColumn } from './result.js';
import { DataSaveFormat } from '../../app/navigation/save.js';


export class Actions {

    static SubmitQuery:Action<{
        altCorp?:string;
    }> = {
        name: 'PQUERY_SUBMIT_QUERY'
    };

    static SubmitQueryDone:Action<{
        corpname: string;
        usesubcorp: string;
        task: Kontext.AsyncTaskInfo<AsyncTaskArgs>;

    }> = {
        name: 'PQUERY_SUBMIT_QUERY_DONE'
    };

    static CloseSuggestAltCorp:Action<{}> = {
        name: 'PQUERY_CLOSE_SUGGEST_ALT_CORP'
    };

    static isSubmitQueryDone(a:Action):a is typeof Actions.SubmitQueryDone {
        return a.name === Actions.SubmitQueryDone.name;
    };

    static ChangePQueryType:Action<{
        qtype:'split'|'full';
    }> = {
        name: 'PQUERY_CHANGE_PQUERY_TYPE'
    };

    static AddQueryItem:Action<{}> = {
        name: 'PQUERY_ADD_QUERY_ITEM'
    };

    static RemoveQueryItem:Action<{
        sourceId: string;
    }> = {
        name: 'PQUERY_REMOVE_QUERY_ITEM'
    };

    static FreqChange:Action<{
        value: string;
    }> = {
        name: 'PQUERY_FREQ_CHANGE'
    };

    static SetPositionIndex:Action<{
        valueLeft: number;
        valueRight: number;
    }> = {
        name: 'PQUERY_SET_POSITION_IDX'
    };

    static SetAlignType:Action<{
        value: AlignTypes|PqueryAlignTypes;
    }> = {
        name: 'PQUERY_SET_ALIGN_TYPE'
    };

    static AttrChange:Action<{
        value: string;
    }> = {
        name: 'PQUERY_ATTR_CHANGE'
    };

    static SortLines:Action<SortColumn> = {
        name: 'PQUERY_RESULTS_SORT_LINES'
    };

    static ConcordanceReady:Action<{
        sourceId:string;
    }> = {
        name: 'PQUERY_ASYNC_CONC_READY'
    };

    static StatePushToHistory:Action<{
        queryId:string;
    }> = {
        name: 'PQUERY_STATE_PUSH_TO_HISTORY'
    };

    static PopHistory:Action<HistoryArgs> = {
        name: 'PQUERY_POP_HISTORY'
    };

    static SetPage:Action<{
        value:string;
    }> = {
        name: 'PQUERY_SET_PAGE'
    };

    static SetPageInput:Action<{
        value:string;
    }> = {
        name: 'PQUERY_SET_PAGE_INPUT'
    };

    static ToggleModalForm:Action<{
        visible:boolean;
    }> = {
        name: 'PQUERY_TOGGLE_MODAL_FORM'
    };

    static SaveFormSetFormat:Action<{
        value:DataSaveFormat;
    }> = {
        name: 'PQUERY_SAVE_FORM_SET_FORMAT'
    };

    static SaveFormSetFromLine:Action<{
        value:string;
    }> = {
        name: 'PQUERY_SAVE_FORM_SET_FROM_LINE'
    };

    static SaveFormSetToLine:Action<{
        value:string;
    }> = {
        name: 'PQUERY_SAVE_FORM_SET_TO_LINE'
    };

    static SaveFormSetIncludeHeading:Action<{
        value:boolean;
    }> = {
        name: 'PQUERY_SAVE_FORM_SET_INCLUDE_HEADING'
    };

    static SaveFormSetIncludeColHeading:Action<{
        value:boolean;
    }> = {
        name: 'PQUERY_SAVE_FORM_SET_INCLUDE_COL_HEADERS'
    };

    static SaveFormSubmit:Action<{
    }> = {
        name: 'PQUERY_SAVE_FORM_SUBMIT'
    };

    static SaveFormPrepareSubmitArgsDone:Action<{
        queryId:string;
        sort:string;
        reverse:number;
    }> = {
        name: 'PQUERY_SAVE_FORM_PREPARE_SUBMIT_ARGS_DONE'
    };

    static ResultCloseSaveForm:Action<{
    }> = {
        name: 'PQUERY_RESULT_CLOSE_SAVE_FORM'
    };

    static ParamsToggleForm:Action<{
    }> = {
        name: 'PQUERY_PARAMS_TOGGLE_FORM'
    };

    static ResultApplyQuickFilter:Action<{
        value:string;
        concId:string;
        blankWindow:boolean;
    }> = {
        name: 'PQUERY_RESULT_APPLY_QUICK_FILTER'
    };

    static ResultApplyQuickFilterArgsReady:Action<{
        attr:string;
        posAlign:AlignTypes|PqueryAlignTypes;
        posLeft:number;
        posRight:number;
    }> = {
        name: 'PQUERY_RESULT_APPLY_QUICK_FILTER_ARGS_READY'
    };

    static isResultApplyQuickFilterArgsReady(a:Action):a is typeof Actions.ResultApplyQuickFilterArgsReady {
        return a.name === Actions.ResultApplyQuickFilterArgsReady.name;
    }

    static SetExpressionRoleType:Action<{
        sourceId:string;
        value:Kontext.PqueryExpressionRoles;
    }> = {
        name: 'PQUERY_SET_EXPRESSION_ROLE_TYPE'
    };

    static SetExpressionRoleRatio:Action<{
        sourceId:string;
        value:string;
    }> = {
        name: 'PQUERY_SET_EXPRESSION_ROLE_RATIO'
    };

    static SetActiveEditor:Action<{
        sourceId:string;
    }> = {
        name: 'PQUERY_SET_ACTIVE_EDITOR'
    };

}