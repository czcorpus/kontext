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
import { MultiDict } from '../../multidict';
import { SaveData } from '../../app/navigation';
import { Dimensions, FreqFilterQuantities, AlignTypes, FreqQuantities } from './twoDimension/common';
import { Maths } from 'cnc-tskit';
import { ColorMappings } from './twoDimension/table2d';


export enum ActionName {
    ResultSetMinFreqVal = 'FREQ_RESULT_SET_MIN_FREQ_VAL',
    ResultApplyMinFreq = 'FREQ_RESULT_APPLY_MIN_FREQ',
    ResultDataLoaded = 'FREQ_RESULT_DATA_LOADED',
    ResultSortByColumn = 'FREQ_RESULT_SORT_BY_COLUMN',
    ResultSetCurrentPage = 'FREQ_RESULT_SET_CURRENT_PAGE',
    ResultCloseSaveForm = 'FREQ_RESULT_CLOSE_SAVE_FORM',
    ResultPrepareSubmitArgsDone = 'FREQ_RESULT_PREPARE_SUBMIT_ARGS_DONE',
    ResultApplyQuickFilter = 'FREQ_RESULT_APPLY_QUICK_FILTER',
    SaveFormSetFormat = 'FREQ_SAVE_FORM_SET_FORMAT',
    SaveFormSetFromLine = 'FREQ_SAVE_FORM_SET_FROM_LINE',
    SaveFormSetToLine = 'FREQ_SAVE_FORM_SET_TO_LINE',
    SaveFormSetIncludeHeading = 'FREQ_SAVE_FORM_SET_INCLUDE_HEADING',
    SaveFormSetIncludeColHeading = 'FREQ_SAVE_FORM_SET_INCLUDE_COL_HEADERS',
    SaveFormSubmit = 'FREQ_SAVE_FORM_SUBMIT',
    SetCtSaveMode = 'FREQ_CT_SET_SAVE_MODE',
    MLSetFLimit = 'FREQ_ML_SET_FLIMIT',
    MLAddLevel = 'FREQ_ML_ADD_LEVEL',
    MLRemoveLevel = 'FREQ_ML_REMOVE_LEVEL',
    MLChangeLevel = 'FREQ_ML_CHANGE_LEVEL',
    MLSetMlxAttr = 'FREQ_ML_SET_MLXATTR',
    MLSetMlxiCase = 'FREQ_ML_SET_MLXICASE',
    MLSetMlxctxIndex = 'FREQ_ML_SET_MLXCTX_INDEX',
    MLSetAlignType = 'FREQ_ML_SET_ALIGN_TYPE',
    MLSubmit = 'FREQ_ML_SUBMIT',
    TTSetFttAttr = 'FREQ_TT_SET_FTTATTR',
    TTSetIncludeEmpty = 'FREQ_TT_SET_FTT_INCLUDE_EMPTY',
    TTSetFLimit = 'FREQ_TT_SET_FLIMIT',
    TTSubmit = 'FREQ_TT_SUBMIT',
    FreqctFormSetDimensionAttr = 'FREQ_CT_FORM_SET_DIMENSION_ATTR',
    FreqctFormSetMinFreqType = 'FREQ_CT_FORM_SET_MIN_FREQ_TYPE',
    FreqctFormSetMinFreq = 'FREQ_CT_FORM_SET_MIN_FREQ',
    FreqctFormSetCtx = 'FREQ_CT_FORM_SET_CTX',
    FreqctFormSetAlignType = 'FREQ_CT_FORM_SET_ALIGN_TYPE',
    FreqctFormSubmit = 'FREQ_CT_SUBMIT',
    FreqctSetAlphaLevel = 'FREQ_CT_SET_ALPHA_LEVEL',
    FreqctSetMinFreq = 'FREQ_CT_SET_MIN_FREQ',
    FreqctSetEmptyVecVisibility = 'FREQ_CT_SET_EMPTY_VEC_VISIBILITY',
    FreqctTransposeTable = 'FREQ_CT_TRANSPOSE_TABLE',
    FreqctSortByDimension = 'FREQ_CT_SORT_BY_DIMENSION',
    FreqctSetDisplayQuantity = 'FREQ_CT_SET_DISPLAY_QUANTITY',
    FreqctSetColorMapping = 'FREQ_CT_SET_COLOR_MAPPING',
    FreqctSetHighlightedGroup = 'FREQ_CT_SET_HIGHLIGHTED_GROUP',
    FreqctSortFlatList = 'FREQ_CT_SORT_FLAT_LIST',
    FreqctHighlight2DCoord = 'FREQ_CT_HIGHLIGHT_2D_COORD',
    FreqctReset2DCoordHighlight = 'FREQ_CT_RESET_2D_COORD_HIGHLIGHT',
    FreqctApplyQuickFilter = 'FREQ_CT_APPLY_QUICK_FILTER',

}


export namespace Actions {

    export interface ResultSetMinFreqVal extends Action<{
        value:string;
    }> {
        name: ActionName.ResultSetMinFreqVal;
    }

    export interface ResultApplyMinFreq extends Action<{
    }> {
        name: ActionName.ResultApplyMinFreq;
    }

    export interface ResultDataLoaded extends Action<{
        data:Array<ResultBlock>;
        resetPage:boolean;
    }> {
        name: ActionName.ResultDataLoaded;
    }

    export interface ResultSortByColumn extends Action<{
        value:string;
    }> {
        name: ActionName.ResultSortByColumn;
    }

    export interface ResultSetCurrentPage extends Action<{
        value:string;
    }> {
        name: ActionName.ResultSetCurrentPage;
    }

    export interface ResultCloseSaveForm extends Action<{
    }> {
        name: ActionName.ResultCloseSaveForm;
    }

    export interface ResultPrepareSubmitArgsDone extends Action<{
        data:MultiDict;
    }> {
        name: ActionName.ResultPrepareSubmitArgsDone;
    }

    export interface ResultApplyQuickFilter extends Action<{
        url:string;
        blankWindow:boolean;
    }> {
        name: ActionName.ResultApplyQuickFilter;
    }

    export interface SaveFormSetFormat extends Action<{
        value:SaveData.Format;
    }> {
        name: ActionName.SaveFormSetFormat;
    }

    export interface SaveFormSetFromLine extends Action<{
        value:string;
    }> {
        name: ActionName.SaveFormSetFromLine;
    }

    export interface SaveFormSetToLine extends Action<{
        value:string;
    }> {
        name: ActionName.SaveFormSetToLine;
    }

    export interface SaveFormSetIncludeHeading extends Action<{
        value:boolean;
    }> {
        name: ActionName.SaveFormSetIncludeHeading;
    }

    export interface SaveFormSetIncludeColHeading extends Action<{
        value:boolean;
    }> {
        name: ActionName.SaveFormSetIncludeColHeading;
    }

    export interface SaveFormSubmit extends Action<{
    }> {
        name: ActionName.SaveFormSubmit;
    }

    export interface SetCtSaveMode extends Action<{
        value:string;
    }> {
        name: ActionName.SetCtSaveMode;
    }

    export interface MLSetFLimit extends Action<{
        value:string;
    }> {
        name: ActionName.MLSetFLimit;
    }

    export interface MLAddLevel extends Action<{
    }> {
        name: ActionName.MLAddLevel;
    }

    export interface MLRemoveLevel extends Action<{
        levelIdx:number;
    }> {
        name: ActionName.MLRemoveLevel;
    }

    export interface MLChangeLevel extends Action<{
        levelIdx:number;
        direction:string;
    }> {
        name: ActionName.MLChangeLevel;
    }

    export interface MLSetMlxAttr extends Action<{
        levelIdx:number;
        value:string;
    }> {
        name: ActionName.MLSetMlxAttr;
    }

    export interface MLSetMlxiCase extends Action<{
        levelIdx:number;
    }> {
        name: ActionName.MLSetMlxiCase;
    }

    export interface MLSetMlxctxIndex extends Action<{
        levelIdx:number;
        value:string;
    }> {
        name: ActionName.MLSetMlxctxIndex;
    }

    export interface MLSetAlignType extends Action<{
        levelIdx:number;
        value:AlignTypes;
    }> {
        name: ActionName.MLSetAlignType;
    }

    export interface MLSubmit extends Action<{
    }> {
        name: ActionName.MLSubmit;
    }

    export interface TTSetFttAttr extends Action<{
        value:string;
    }> {
        name: ActionName.TTSetFttAttr;
    }

    export interface TTSetIncludeEmpty extends Action<{
    }> {
        name: ActionName.TTSetIncludeEmpty;
    }

    export interface TTSetFLimit extends Action<{
        value:string;
    }> {
        name: ActionName.TTSetFLimit;
    }

    export interface TTSubmit extends Action<{
    }> {
        name: ActionName.TTSubmit;
    }

    export interface FreqctFormSetDimensionAttr extends Action<{
        dimension:Dimensions;
        value:string;
    }> {
        name: ActionName.FreqctFormSetDimensionAttr;
    }

    export interface FreqctFormSetMinFreqType extends Action<{
        value:FreqFilterQuantities;
    }> {
        name: ActionName.FreqctFormSetMinFreqType;
    }

    export interface FreqctFormSetMinFreq extends Action<{
        value:string;
    }> {
        name: ActionName.FreqctFormSetMinFreq;
    }

    export interface FreqctFormSetCtx extends Action<{
        dim:Dimensions;
        value:number;
    }> {
        name: ActionName.FreqctFormSetCtx;
    }

    export interface FreqctFormSetAlignType extends Action<{
        dim:Dimensions;
        value:AlignTypes;
    }> {
        name: ActionName.FreqctFormSetAlignType;
    }

    export interface FreqctFormSubmit extends Action<{
    }> {
        name: ActionName.FreqctFormSubmit;
    }

    export interface FreqctSetAlphaLevel extends Action<{
        value:Maths.AlphaLevel;
    }> {
        name: ActionName.FreqctSetAlphaLevel;
    }

    export interface FreqctSetMinFreq extends Action<{
        value:string;
    }> {
        name: ActionName.FreqctSetMinFreq;
    }

    export interface FreqctSetEmptyVecVisibility extends Action<{
        value:boolean;
    }> {
        name: ActionName.FreqctSetEmptyVecVisibility;
    }

    export interface FreqctTransposeTable extends Action<{
    }> {
        name: ActionName.FreqctTransposeTable;
    }

    export interface FreqctSortByDimension extends Action<{
        dim:Dimensions;
        attr:string;
    }> {
        name: ActionName.FreqctSortByDimension;
    }

    export interface FreqctSetDisplayQuantity extends Action<{
        value:FreqQuantities;
    }> {
        name: ActionName.FreqctSetDisplayQuantity;
    }

    export interface FreqctSetColorMapping extends Action<{
        value:ColorMappings;
    }> {
        name: ActionName.FreqctSetColorMapping;
    }

    export interface FreqctSetHighlightedGroup extends Action<{
        value:[number, number];
    }> {
        name: ActionName.FreqctSetHighlightedGroup;
    }

    export interface FreqctSortFlatList extends Action<{
        value:string;
        reversed:boolean;
    }> {
        name: ActionName.FreqctSortFlatList;
    }

    export interface FreqctHighlight2DCoord extends Action<{
        coord:[number, number];
    }> {
        name: ActionName.FreqctHighlight2DCoord;
    }

    export interface FreqctReset2DCoordHighlight extends Action<{
    }> {
        name: ActionName.FreqctReset2DCoordHighlight;
    }

    export interface FreqctApplyQuickFilter extends Action<{
        url:string;
    }> {
        name: ActionName.FreqctApplyQuickFilter;
    }

}
