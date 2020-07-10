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
import { AlignTypes } from './ctFreqForm';


export enum ActionName {
    ResultSetMinFreqVal = 'FREQ_RESULT_SET_MIN_FREQ_VAL',
    ResultApplyMinFreq = 'FREQ_RESULT_APPLY_MIN_FREQ',
    ResultDataLoaded = 'FREQ_RESULT_DATA_LOADED',
    ResultSortByColumn = 'FREQ_RESULT_SORT_BY_COLUMN',
    ResultSetCurrentPage = 'FREQ_RESULT_SET_CURRENT_PAGE',
    ResultCloseSaveForm = 'FREQ_RESULT_CLOSE_SAVE_FORM',
    ResultPrepareSubmitArgsDone = 'FREQ_RESULT_PREPARE_SUBMIT_ARGS_DONE',
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
    TTSubmit = 'FREQ_TT_SUBMIT'
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

}