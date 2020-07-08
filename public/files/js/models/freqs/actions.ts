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


export enum ActionName {
    ResultSetMinFreqVal = 'FREQ_RESULT_SET_MIN_FREQ_VAL',
    ResultApplyMinFreq = 'FREQ_RESULT_APPLY_MIN_FREQ',
    ResultDataLoaded = 'FREQ_RESULT_DATA_LOADED',
    ResultSortByColumn = 'FREQ_RESULT_SORT_BY_COLUMN',
    ResultSetCurrentPage = 'FREQ_RESULT_SET_CURRENT_PAGE',
    ResultCloseSaveForm = 'FREQ_RESULT_CLOSE_SAVE_FORM',
    ResultPrepareSubmitArgsDone = 'FREQ_RESULT_PREPARE_SUBMIT_ARGS_DONE'
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

}