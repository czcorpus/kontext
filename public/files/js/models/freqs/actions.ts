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
import { Dimensions, FreqFilterQuantities, AlignTypes, FreqQuantities } from './twoDimension/common';
import { Maths } from 'cnc-tskit';
import { ColorMappings } from './twoDimension/table2d';
import { HistoryState } from './common';
import { DataSaveFormat } from '../../app/navigation/save';


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

    static SetCtSaveMode: Action<{
        value:string;
    }> = {
            name: 'FREQ_CT_SET_SAVE_MODE'
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

    static FreqctFormSetDimensionAttr: Action<{
        dimension:Dimensions;
        value:string;
    }> = {
            name: 'FREQ_CT_FORM_SET_DIMENSION_ATTR'
        };

    static FreqctFormSetMinFreqType: Action<{
        value: FreqFilterQuantities;
    }> = {
            name: 'FREQ_CT_FORM_SET_MIN_FREQ_TYPE'
        };

    static FreqctFormSetMinFreq: Action<{
        value:string;
    }> = {
            name: 'FREQ_CT_FORM_SET_MIN_FREQ'
        };

    static FreqctFormSetCtx: Action<{
        dim:Dimensions;
        value:number;
    }> = {
            name: 'FREQ_CT_FORM_SET_CTX'
        };

    static FreqctFormSetAlignType: Action<{
        dim:Dimensions;
        value:AlignTypes;
    }> = {
            name: 'FREQ_CT_FORM_SET_ALIGN_TYPE'
        };

    static FreqctFormSubmit: Action<{
    }> = {
            name: 'FREQ_CT_SUBMIT'
        };

    static FreqctSetAlphaLevel: Action<{
        value:Maths.AlphaLevel;
    }> = {
            name: 'FREQ_CT_SET_ALPHA_LEVEL'
        };

    static FreqctSetMinFreq: Action<{
        value:string;
    }> = {
            name: 'FREQ_CT_SET_MIN_FREQ'
        };

    static FreqctSetEmptyVecVisibility: Action<{
        value:boolean;
    }> = {
            name: 'FREQ_CT_SET_EMPTY_VEC_VISIBILITY'
        };

    static FreqctTransposeTable: Action<{
    }> = {
            name: 'FREQ_CT_TRANSPOSE_TABLE'
        };

    static FreqctSortByDimension: Action<{
        dim:Dimensions;
        attr:string;
    }> = {
            name: 'FREQ_CT_SORT_BY_DIMENSION'
        };

    static FreqctSetDisplayQuantity: Action<{
        value:FreqQuantities;
    }> = {
            name: 'FREQ_CT_SET_DISPLAY_QUANTITY'
        };

    static FreqctSetColorMapping: Action<{
        value:ColorMappings;
    }> = {
            name: 'FREQ_CT_SET_COLOR_MAPPING'
        };

    static FreqctSetHighlightedGroup: Action<{
        value:[number, number];
    }> = {
            name: 'FREQ_CT_SET_HIGHLIGHTED_GROUP'
        };

    static FreqctSortFlatList: Action<{
        value:string;
        reversed:boolean;
    }> = {
            name: 'FREQ_CT_SORT_FLAT_LIST'
        };

    static FreqctHighlight2DCoord: Action<{
        coord:[number, number];
    }> = {
            name: 'FREQ_CT_HIGHLIGHT_2D_COORD'
        };

    static FreqctReset2DCoordHighlight: Action<{
    }> = {
            name: 'FREQ_CT_RESET_2D_COORD_HIGHLIGHT'
        };

    static FreqctApplyQuickFilter: Action<{
        url:string;
    }> = {
            name: 'FREQ_CT_APPLY_QUICK_FILTER'
        };

}
