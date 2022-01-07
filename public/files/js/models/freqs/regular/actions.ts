/*
 * Copyright (c) 2020 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2020 Martin Zimandl <martin.zimandl@gmail.com>
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
import { ResultBlock } from './dataRows';
import { AlignTypes } from '../twoDimension/common';
import { HistoryState } from '../common';
import { DataSaveFormat } from '../../../app/navigation/save';


export class Actions {

    static ResultSetMinFreqVal: Action<{
        value:string;
    }> = {
            name: 'FREQ_RESULT_SET_MIN_FREQ_VAL'
        };

    static ResultApplyMinFreq: Action<{
    }> = {
            name: 'FREQ_RESULT_APPLY_MIN_FREQ'
        };

    static ResultDataLoaded: Action<{
        data:Array<ResultBlock>;
    }> = {
            name: 'FREQ_RESULT_DATA_LOADED'
        };

    static StatePushToHistory: Action<{
    }> = {
            name: 'FREQ_STATE_PUSH_TO_HISTORY'
        };

    static PopHistory: Action<HistoryState> = {
        name: 'FREQ_POP_HISTORY'
    };

    static ResultSortByColumn: Action<{
        value:string;
    }> = {
            name: 'FREQ_RESULT_SORT_BY_COLUMN'
        };

    static ResultSetCurrentPage: Action<{
        value:string;
    }> = {
            name: 'FREQ_RESULT_SET_CURRENT_PAGE'
        };

    static ResultCloseSaveForm: Action<{
    }> = {
            name: 'FREQ_RESULT_CLOSE_SAVE_FORM'
        };

    static ResultPrepareSubmitArgsDone: Action<{
        data:{};
    }> = {
            name: 'FREQ_RESULT_PREPARE_SUBMIT_ARGS_DONE'
        };

    static ResultApplyQuickFilter: Action<{
        url:string;
        blankWindow:boolean;
    }> = {
            name: 'FREQ_RESULT_APPLY_QUICK_FILTER'
        };

    static SaveFormSetFormat: Action<{
        value:DataSaveFormat;
    }> = {
            name: 'FREQ_SAVE_FORM_SET_FORMAT'
        };

    static SaveFormSetFromLine: Action<{
        value:string;
    }> = {
            name: 'FREQ_SAVE_FORM_SET_FROM_LINE'
        };

    static SaveFormSetToLine: Action<{
        value:string;
    }> = {
            name: 'FREQ_SAVE_FORM_SET_TO_LINE'
        };

    static SaveFormSetIncludeHeading: Action<{
        value:boolean;
    }> = {
            name: 'FREQ_SAVE_FORM_SET_INCLUDE_HEADING'
        };

    static SaveFormSetIncludeColHeading: Action<{
        value:boolean;
    }> = {
            name: 'FREQ_SAVE_FORM_SET_INCLUDE_COL_HEADERS'
        };

    static SaveFormSubmit: Action<{
    }> = {
            name: 'FREQ_SAVE_FORM_SUBMIT'
        };

    static MLSetFLimit: Action<{
        value:string;
    }> = {
            name: 'FREQ_ML_SET_FLIMIT'
        };

    static MLAddLevel: Action<{
    }> = {
            name: 'FREQ_ML_ADD_LEVEL'
        };

    static MLRemoveLevel: Action<{
        levelIdx:number;
    }> = {
            name: 'FREQ_ML_REMOVE_LEVEL'
        };

    static MLChangeLevel: Action<{
        levelIdx:number;
        direction:string;
    }> = {
            name: 'FREQ_ML_CHANGE_LEVEL'
        };

    static MLSetMlxAttr: Action<{
        levelIdx:number;
        value:string;
    }> = {
            name: 'FREQ_ML_SET_MLXATTR'
        };

    static MLSetMlxiCase: Action<{
        levelIdx:number;
    }> = {
            name: 'FREQ_ML_SET_MLXICASE'
        };

    static MLSetMlxctxIndex: Action<{
        levelIdx:number;
        value:string;
    }> = {
            name: 'FREQ_ML_SET_MLXCTX_INDEX'
        };

    static MLSetAlignType: Action<{
        levelIdx:number;
        value:AlignTypes;
    }> = {
            name: 'FREQ_ML_SET_ALIGN_TYPE'
        };

    static MLSubmit: Action<{
    }> = {
            name: 'FREQ_ML_SUBMIT'
        };

    static TTSetFttAttr: Action<{
        value:string;
    }> = {
            name: 'FREQ_TT_SET_FTTATTR'
        };

    static TTSetIncludeEmpty: Action<{
    }> = {
            name: 'FREQ_TT_SET_FTT_INCLUDE_EMPTY'
        };

    static TTSetFLimit: Action<{
        value:string;
    }> = {
            name: 'FREQ_TT_SET_FLIMIT'
        };

    static TTSubmit: Action<{
    }> = {
            name: 'FREQ_TT_SUBMIT'
        };
}
