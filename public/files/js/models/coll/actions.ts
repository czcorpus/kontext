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
import { MultiDict } from '../../multidict';
import { AjaxResponse, CollSaveServerArgs, CollServerArgs, HistoryState } from './common';
import { ConcQuickFilterServerArgs } from '../concordance/common';

export enum ActionName {
    ResultSetPageInputVal = 'COLL_RESULT_SET_PAGE_INPUT_VAL',
    ResultGetNextPage = 'COLL_RESULT_GET_NEXT_PAGE',
    ResultGetPrevPage = 'COLL_RESULT_GET_PREV_PAGE',
    ResultConfirmPageValue = 'COLL_RESULT_CONFIRM_PAGE_VALUE',
    ResultPageLoadDone = 'COLL_RESULT_PAGE_LOAD_DONE',
    ResultSortByColumn = 'COLL_RESULT_SORT_BY_COLUMN',
    ResultApplyQuickFilter = 'COLL_RESULT_APPLY_QUICK_FILTER',
    ResultUpdateCalculation = 'COLL_RESULT_UPDATE_CALCULATION',
    ResultCloseSaveForm = 'COLL_RESULT_CLOSE_SAVE_FORM',
    ResultReload = 'COLL_RESULT_RELOAD',
    FormSetCattr = 'COLL_FORM_SET_CATTR',
    FormSetCfromw = 'COLL_FORM_SET_CFROMW',
    FormSetCtow = 'COLL_FORM_SET_CTOW',
    FormSetCminFreq = 'COLL_FORM_SET_CMINFREQ',
    FormSetCminbgr = 'COLL_FORM_SET_CMINBGR',
    FormSetCbgrfns = 'COLL_FORM_SET_CBGRFNS',
    FormSetCsortfn = 'COLL_FORM_SET_CSORTFN',
    FormPrepareSubmitArgsDone = 'COLL_FORM_PREPARE_SUBMIT_ARGS_DONE',
    FormSubmit = 'COLL_FORM_SUBMIT',
    SaveFormSetFormat = 'COLL_SAVE_FORM_SET_FORMAT',
    SaveFormSetFromLine = 'COLL_SAVE_FORM_SET_FROM_LINE',
    SaveFormSetToLine = 'COLL_SAVE_FORM_SET_TO_LINE',
    SaveFormSetIncludeColHeaders = 'COLL_SAVE_FORM_SET_INCLUDE_COL_HEADERS',
    SaveFormSetIncludeHeading = 'COLL_SAVE_FORM_SET_INCLUDE_HEADING',
    SaveFormSubmit = 'COLL_SAVE_FORM_SUBMIT',
    SaveFormSubmitDone = 'COLL_SAVE_FORM_SUBMIT_DONE',
    StatePushToHistory = 'COLL_STATE_PUSH_TO_HISTORY',
    PopHistory = 'COLL_POP_HISTORY',
}

export namespace Actions {

    export interface ResultSetPageInputVal extends Action<{
        value:string;
    }> {
        name:ActionName.ResultSetPageInputVal;
    }

    export interface ResultGetNextPage extends Action<{

    }> {
        name:ActionName.ResultGetNextPage;
    }

    export interface ResultGetPrevPage extends Action<{

    }> {
        name:ActionName.ResultGetPrevPage;
    }

    export interface ResultConfirmPageValue extends Action<{

    }> {
        name:ActionName.ResultConfirmPageValue;
    }

    export interface ResultPageLoadDone extends Action<{
        response:AjaxResponse;
    }> {
        name:ActionName.ResultPageLoadDone;
    }

    export interface ResultSortByColumn extends Action<{
        sortFn:string;
    }> {
        name:ActionName.ResultSortByColumn;
    }

    export interface ResultApplyQuickFilter extends Action<{
        args:Array<[keyof ConcQuickFilterServerArgs, ConcQuickFilterServerArgs[keyof ConcQuickFilterServerArgs]]>;
        blankWindow:boolean;
    }> {
        name:ActionName.ResultApplyQuickFilter;
    }

    export interface ResultUpdateCalculation extends Action<{
        calcStatus:number;
    }> {
        name:ActionName.ResultUpdateCalculation;
    }

    export interface ResultCloseSaveForm extends Action<{
    }> {
        name:ActionName.ResultCloseSaveForm;
    }

    export interface ResultReload extends Action<{
    }> {
        name:ActionName.ResultReload;
    }

    export interface FormSetCattr extends Action<{
        value:string;
    }> {
        name:ActionName.FormSetCattr;
    }

    export interface FormSetCfromw extends Action<{
        value:string;
    }> {
        name:ActionName.FormSetCfromw;
    }

    export interface FormSetCtow extends Action<{
        value:string;
    }> {
        name:ActionName.FormSetCtow;
    }

    export interface FormSetCminFreq extends Action<{
        value:string;
    }> {
        name:ActionName.FormSetCminFreq;
    }

    export interface FormSetCminbgr extends Action<{
        value:string;
    }> {
        name:ActionName.FormSetCminbgr;
    }

    export interface FormSetCbgrfns extends Action<{
        value:string;
    }> {
        name:ActionName.FormSetCbgrfns;
    }

    export interface FormSetCsortfn extends Action<{
        value:string;
    }> {
        name:ActionName.FormSetCsortfn;
    }

    export interface FormPrepareSubmitArgsDone extends Action<{
        args:MultiDict<CollSaveServerArgs>;
    }> {
        name:ActionName.FormPrepareSubmitArgsDone;
    }

    export interface FormSubmit extends Action<{

    }> {
        name:ActionName.FormSubmit;
    }

    export interface SaveFormSetFormat extends Action<{
        value:string;
    }> {
        name:ActionName.SaveFormSetFormat;
    }

    export interface SaveFormSetFromLine extends Action<{
        value:string;
    }> {
        name:ActionName.SaveFormSetFromLine;
    }

    export interface SaveFormSetToLine extends Action<{
        value:string;
    }> {
        name:ActionName.SaveFormSetToLine;
    }

    export interface SaveFormSetIncludeColHeaders extends Action<{
        value:boolean;
    }> {
        name:ActionName.SaveFormSetIncludeColHeaders;
    }

    export interface SaveFormSetIncludeHeading extends Action<{
        value:boolean;
    }> {
        name:ActionName.SaveFormSetIncludeHeading;
    }

    export interface SaveFormSubmit extends Action<{
    }> {
        name: ActionName.SaveFormSubmit;
    }

    export interface SaveFormSubmitDone extends Action<{
    }> {
        name: ActionName.SaveFormSubmitDone;
    }

    export interface StatePushToHistory extends Action<MultiDict<CollServerArgs>> {
        name: ActionName.StatePushToHistory;
    }

    export interface PopHistory extends Action<HistoryState> {
        name: ActionName.PopHistory;
    }
}