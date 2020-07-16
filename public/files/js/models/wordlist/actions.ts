/*
 * Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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
import { IndexedResultItem, WlTypes, FileTarget } from './common';
import { SaveData } from '../../app/navigation';


export enum ActionName {
    WordlistResultViewConc = 'WORDLIST_RESULT_VIEW_CONC',
    WordlistResultReload = 'WORDLIST_RESULT_RELOAD',
    WordlistFormSubmitReady = 'WORDLIST_FORM_SUBMIT_READY',
    WordlistResultNextPage = 'WORDLIST_RESULT_NEXT_PAGE',
    WordlistResultPrevPage = 'WORDLIST_RESULT_PREV_PAGE',
    WordlistResultSetPage = 'WORDLIST_RESULT_SET_PAGE',
    WordlistResultConfirmPage = 'WORDLIST_RESULT_CONFIRM_PAGE',
    WordlistGoToFirstPage = 'WORDLIST_GO_TO_FIRST_PAGE',
    WordlistPageLoadDone = 'WORDLIST_PAGE_LOAD_DONE',
    WordlistGoToLastPage = 'WORDLIST_GO_TO_LAST_PAGE',
    WordlistFormSelectAttr = 'WORDLIST_FORM_SELECT_ATTR',
    WordlistFormSetWlpat = 'WORDLIST_FORM_SET_WLPAT',
    WordlistFormSetWlnums = 'WORDLIST_FORM_SET_WLNUMS',
    WordlistFormSelectWlposattr = 'WORDLIST_FORM_SELECT_WLPOSATTR',
    WordlistFormSetWltype = 'WORDLIST_FORM_SET_WLTYPE',
    WordlistFormSetWlminfreq = 'WORDLIST_FORM_SET_WLMINFREQ',
    WordlistFormSetIncludeNonwords = 'WORDLIST_FORM_SET_INCLUDE_NONWORDS',
    WordlistFormAddPosattrLevel = 'WORDLIST_FORM_ADD_POSATTR_LEVEL',
    WordlistFormCreateWhitelist = 'WORDLIST_FORM_CREATE_WHITELIST',
    WordlistFormCreateBlacklist = 'WORDLIST_FORM_CREATE_BLACKLIST',
    WordlistFormSetFilter = 'WORDLIST_FORM_SET_FILTER_FILE',
    WordlistFormSetFilterDone = 'WORDLIST_FORM_SET_FILTER_FILE_DONE',
    WordlistFormUpdateEditor = 'WORDLIST_FORM_UPDATE_EDITOR',
    WordlistFormReopenEditor = 'WORDLIST_FORM_REOPEN_EDITOR',
    WordlistFormClearFilterFile = 'WORDLIST_FORM_CLEAR_FILTER_FILE',
    WordlistFormCloseEditor = 'WORDLIST_FORM_CLOSE_EDITOR',
    WordlistResultSetSortColumn = 'WORDLIST_RESULT_SET_SORT_COLUMN',
    WordlistFormSubmit = 'WORDLIST_FORM_SUBMIT',
    WordlistSaveFormHide = 'WORDLIST_SAVE_FORM_HIDE',
    WordlistSaveFormSetMaxLine = 'WORDLIST_SAVE_FORM_SET_MAX_LINE',
    WordlistSaveFormSetFormat = 'WORDLIST_SAVE_FORM_SET_FORMAT',
    WordlistSaveSetIncludeHeading = 'WORDLIST_SAVE_SET_INCLUDE_HEADING',
    WordlistSaveSetIncludeColHeaders = 'WORDLIST_SAVE_SET_INCLUDE_COL_HEADERS',
    WordlistSaveFormSubmit = 'WORDLIST_SAVE_FORM_SUBMIT',
    WordlistSaveFormSubmitDone = 'WORDLIST_SAVE_FORM_SUBMIT_DONE',
    WordlistHistoryPopState = 'WORDLIST_HISTORY_POP_STATE',
    WordlistIntermediateBgCalcUpdated = 'WORDLIST_INTERMEDIATE_BG_CALC_UPDATED'
}


export namespace Actions {

    export interface WordlistResultViewConc extends Action<{
        word:string;
    }>{
        name:ActionName.WordlistResultViewConc;
    };

    export interface WordlistResultReload extends Action<{
    }>{
        name:ActionName.WordlistResultReload;
    };

    export interface WordlistFormSubmitReady extends Action<{
        args:MultiDict; // TODO not very type safe here
    }> {
        name:ActionName.WordlistFormSubmitReady;
    }

    export interface WordlistResultNextPage extends Action<{
    }>{
        name:ActionName.WordlistResultNextPage;
    };

    export interface WordlistResultPrevPage extends Action<{
    }>{
        name:ActionName.WordlistResultPrevPage;
    };

    export interface WordlistResultSetPage extends Action<{
        page:string;
    }>{
        name:ActionName.WordlistResultSetPage;
    };

    export interface WordlistResultConfirmPage extends Action<{
        page:string;
    }> {
        name:ActionName.WordlistResultConfirmPage;
    }

    export interface WordlistGoToFirstPage extends Action<{
    }> {
        name:ActionName.WordlistGoToFirstPage;
    }

    export interface WordlistPageLoadDone extends Action<{
        page:number;
        isLast:boolean;
        newNumOfItems?:number;
        data:Array<IndexedResultItem>;
    }>{
        name:ActionName.WordlistPageLoadDone;
    };

    export interface WordlistFormSelectAttr extends Action<{
        value:string;
    }>{
        name:ActionName.WordlistFormSelectAttr;
    }

    export interface WordlistFormSetWlpat extends Action<{
        value:string;
    }>{
        name:ActionName.WordlistFormSetWlpat;
    }

    export interface WordlistFormSetWlnums extends Action<{
        value:string;
    }> {
        name:ActionName.WordlistFormSetWlnums;
    }

    export interface WordlistFormSelectWlposattr extends Action<{
        position:number;
        value:string;
    }> {
        name:ActionName.WordlistFormSelectWlposattr;
    }

    export interface WordlistFormSetWltype extends Action<{
        value:WlTypes;
    }> {
        name:ActionName.WordlistFormSetWltype;
    }

    export interface WordlistFormSetWlminfreq extends Action<{
        value:string;
    }> {
        name:ActionName.WordlistFormSetWlminfreq;
    }

    export interface WordlistFormSetIncludeNonwords extends Action<{
        value:boolean;
    }> {
        name:ActionName.WordlistFormSetIncludeNonwords;
    }

    export interface WordlistFormAddPosattrLevel extends Action<{
    }> {
        name:ActionName.WordlistFormAddPosattrLevel;
    }

    export interface WordlistFormCreateWhitelist extends Action<{

    }> {
        name:ActionName.WordlistFormCreateWhitelist;
    }

    export interface WordlistFormCreateBlacklist extends Action<{

    }> {
        name:ActionName.WordlistFormCreateBlacklist;
    }

    export interface WordlistFormSetFilter extends Action<{
        value:File;
        target:FileTarget;
    }> {
        name:ActionName.WordlistFormSetFilter;
    }

    export interface WordlistFormSetFilterDone extends Action<{

    }> {
        name:ActionName.WordlistFormSetFilterDone;
    }

    export interface WordlistFormUpdateEditor extends Action<{
        value:string;
    }> {
        name:ActionName.WordlistFormUpdateEditor;
    }

    export interface WordlistFormReopenEditor extends Action<{
        target:FileTarget;
    }> {
        name:ActionName.WordlistFormReopenEditor;
    }

    export interface WordlistFormClearFilterFile extends Action<{
        target:FileTarget;
    }> {
        name:ActionName.WordlistFormClearFilterFile;
    }

    export interface WordlistFormCloseEditor extends Action<{
    }> {
        name:ActionName.WordlistFormCloseEditor;
    }

    export interface WordlistResultSetSortColumn extends Action<{
        sortKey:string;
    }> {
        name:ActionName.WordlistResultSetSortColumn;
    }

    export interface WordlistFormSubmit extends Action<{
    }> {
        name:ActionName.WordlistFormSubmit;
    }

    export interface WordlistGoToLastPage extends Action<{
    }> {
        name:ActionName.WordlistGoToLastPage;
    }

    export interface WordlistSaveFormHide extends Action<{
    }> {
        name:ActionName.WordlistSaveFormHide;
    }

    export interface WordlistSaveFormSetMaxLine extends Action<{
        value:string;
    }> {
        name:ActionName.WordlistSaveFormSetMaxLine;
    }

    export interface WordlistSaveFormSetFormat extends Action<{
        value:SaveData.Format;
    }> {
        name:ActionName.WordlistSaveFormSetFormat;
    }

    export interface WordlistSaveSetIncludeHeading extends Action<{
        value:boolean;
    }> {
        name:ActionName.WordlistSaveSetIncludeHeading;
    }

    export interface WordlistSaveSetIncludeColHeaders extends Action<{
        value:boolean;
    }> {
        name:ActionName.WordlistSaveSetIncludeColHeaders;
    }

    export interface WordlistSaveFormSubmit extends Action<{
    }> {
        name:ActionName.WordlistSaveFormSubmit;
    }

    export interface WordlistSaveFormSubmitDone extends Action<{
    }> {
        name:ActionName.WordlistSaveFormSubmitDone;
    }

    export interface WordlistHistoryPopState extends Action<{
        currPageInput:string;
    }> {
        name:ActionName.WordlistHistoryPopState;
    }

    export interface WordlistIntermediateBgCalcUpdated extends Action<{
        status:number;
    }> {
        name:ActionName.WordlistIntermediateBgCalcUpdated;
    }
}