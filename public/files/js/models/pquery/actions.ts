/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
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
import { Kontext } from '../../types/common';
import { AlignTypes } from '../freqs/twoDimension/common';
import { AsyncTaskArgs, HistoryArgs } from './common';
import { SortColumn } from './result';
import {SaveData} from '../../app/navigation';


export enum ActionName {

    SubmitQuery = 'PQUERY_SUBMIT_QUERY',
    SubmitQueryDone = 'PQUERY_SUBMIT_QUERY_DONE',
    AddQueryItem = 'PQUERY_ADD_QUERY_ITEM',
    RemoveQueryItem = 'PQUERY_REMOVE_QUERY_ITEM',
    FreqChange = 'PQUERY_FREQ_CHANGE',
    SetPositionIndex = 'PQUERY_SET_POSITION_IDX',
    SetAlignType = 'PQUERY_SET_ALIGN_TYPE',
    AttrChange = 'PQUERY_ATTR_CHANGE',
    SortLines = 'PQUERY_RESULTS_SORT_LINES',
    ConcordanceReady = 'PQUERY_ASYNC_CONC_READY',
    StatePushToHistory = 'PQUERY_STATE_PUSH_TO_HISTORY',
    PopHistory = 'PQUERY_POP_HISTORY',
    SetPage = 'PQUERY_SET_PAGE',
    ToggleModalForm = 'PQUERY_TOGGLE_MODAL_FORM',
    SaveFormSetFormat = 'PQUERY_SAVE_FORM_SET_FORMAT',
    SaveFormSetFromLine = 'PQUERY_SAVE_FORM_SET_FROM_LINE',
    SaveFormSetToLine = 'PQUERY_SAVE_FORM_SET_TO_LINE',
    SaveFormSetIncludeHeading = 'PQUERY_SAVE_FORM_SET_INCLUDE_HEADING',
    SaveFormSetIncludeColHeading = 'PQUERY_SAVE_FORM_SET_INCLUDE_COL_HEADERS',
    SaveFormSubmit = 'PQUERY_SAVE_FORM_SUBMIT',
    SaveFormPrepareSubmitArgsDone = 'PQUERY_SAVE_FORM_PREPARE_SUBMIT_ARGS_DONE',
    ResultCloseSaveForm = 'PQUERY_RESULT_CLOSE_SAVE_FORM',
    ParamsToggleForm = 'PQUERY_PARAMS_TOGGLE_FORM',
    ResultApplyQuickFilter = 'PQUERY_RESULT_APPLY_QUICK_FILTER',
    ResultApplyQuickFilterArgsReady = 'PQUERY_RESULT_APPLY_QUICK_FILTER_ARGS_READY'
}


export namespace Actions {

    export interface SubmitQuery extends Action<{

    }> {
        name: ActionName.SubmitQuery;
    }

    export interface SubmitQueryDone extends Action<{
        corpname:string;
        usesubcorp:string;
        task:Kontext.AsyncTaskInfo<AsyncTaskArgs>;

    }> {
        name: ActionName.SubmitQueryDone;
    }

    export function isSubmitQueryDone(a:Action):a is SubmitQueryDone {
        return a.name === ActionName.SubmitQueryDone;
    }

    export interface AddQueryItem extends Action<{

    }> {
        name: ActionName.AddQueryItem;
    }

    export interface RemoveQueryItem extends Action<{
        sourceId: string;
    }> {
        name: ActionName.RemoveQueryItem;
    }

    export interface FreqChange extends Action<{
        value: string;
    }> {
        name: ActionName.FreqChange;
    }

    export interface SetPositionIndex extends Action<{
        value: number;
    }> {
        name: ActionName.SetPositionIndex;
    }

    export interface SetAlignType extends Action<{
        value: AlignTypes;
    }> {
        name: ActionName.SetAlignType;
    }

    export interface AttrChange extends Action<{
        value: string;
    }> {
        name: ActionName.AttrChange;
    }

    export interface SortLines extends Action<SortColumn> {
        name: ActionName.SortLines;
    }

    export interface ConcordanceReady extends Action<{
        sourceId:string;
    }> {
        name: ActionName.ConcordanceReady
    }

    export interface StatePushToHistory extends Action<{
        queryId:string;
    }> {
        name: ActionName.StatePushToHistory;
    }

    export interface PopHistory extends Action<HistoryArgs> {
        name: ActionName.PopHistory;
    }

    export interface SetPage extends Action<{
        value: number;
    }> {
        name: ActionName.SetPage;
    }

    export interface ToggleModalForm extends Action<{
        visible:boolean;
    }> {
        name: ActionName.ToggleModalForm;
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

    export interface SaveFormPrepareSubmitArgsDone extends Action<{
        queryId:string;
        sort:string;
        reverse:number;
    }> {
        name:ActionName.SaveFormPrepareSubmitArgsDone;
    }

    export interface ResultCloseSaveForm extends Action<{
    }> {
        name: ActionName.ResultCloseSaveForm;
    }

    export interface ParamsToggleForm extends Action<{
    }> {
        name: ActionName.ParamsToggleForm;
    }

    export interface ResultApplyQuickFilter extends Action<{
        value:string;
        concId:string;
        blankWindow:boolean;
    }> {
        name: ActionName.ResultApplyQuickFilter;
    }

    export interface ResultApplyQuickFilterArgsReady extends Action<{
        attr:string;
        posAlign:AlignTypes;
        posSpec:string; // the Manatee format (e.g. 0<0)
    }> {
        name: ActionName.ResultApplyQuickFilterArgsReady;
    }

    export function isResultApplyQuickFilterArgsReady(a:Action):a is ResultApplyQuickFilterArgsReady {
        return a.name === ActionName.ResultApplyQuickFilterArgsReady;
    }
}