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
    SetCtSaveMode = 'FREQ_CT_SET_SAVE_MODE'
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
}