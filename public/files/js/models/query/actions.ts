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
import { Kontext } from '../../types/common';
import { AjaxResponse } from '../../types/ajaxResponses';


export enum ActionName {

    ClearQueryOverviewData = 'CLEAR_QUERY_OVERVIEW_DATA',
    MainMenuOverviewShowQueryInfo = 'MAIN_MENU_OVERVIEW_SHOW_QUERY_INFO',
    MainMenuOverviewShowQueryInfoDone = 'MAIN_MENU_OVERVIEW_SHOW_QUERY_INFO_DONE',
    EditQueryOperation = 'EDIT_QUERY_OPERATION',
    EditLastQueryOperation = 'EDIT_LAST_QUERY_OPERATION',
    EditQueryOperationDone = 'EDIT_QUERY_OPERATION_DONE',
    BranchQuery = 'BRANCH_QUERY',
    BranchQueryDone = 'BRANCH_QUERY_DONE',
    QuerySetStopAfterIdx = 'QUERY_SET_STOP_AFTER_IDX',
    RedirectToEditQueryOperation = 'REDIRECT_TO_EDIT_QUERY_OPERATION',
    QueryOverviewEditorClose = 'QUERY_OVERVIEW_EDITOR_CLOSE',
    LockQueryPipeline = 'LOCK_QUERY_PIPELINE',
    QueryInputUnhitVirtualKeyboardKey = 'QUERY_INPUT_UNHIT_VIRTUAL_KEYBOARD_KEY',
    QueryInputHitVirtualKeyboardKey = 'QUERY_INPUT_HIT_VIRTUAL_KEYBOARD_KEY',
    QueryInputSetVirtualKeyboardLayout = 'QUERY_INPUT_SET_VIRTUAL_KEYBOARD_LAYOUT',
    QueryInputToggleVirtualKeyboardShift = 'QUERY_INPUT_TOGGLE_VIRTUAL_KEYBOARD_SHIFT',
    QueryInputUnhitVirtualKeyboardShift = 'QUERY_INPUT_UNHIT_VIRTUAL_KEYBOARD_SHIFT',
    QueryInputToggleVirtualKeyboardCaps = 'QUERY_INPUT_TOGGLE_VIRTUAL_KEYBOARD_CAPS',
    QueryInputSelectContextFormItem = 'QUERY_INPUT_SELECT_CONTEXT_FORM_ITEM',
    QueryContextToggleForm = 'QUERY_CONTEXT_TOGGLE_FORM',
    QueryTextTypesToggleForm = 'QUERY_TEXT_TYPES_TOGGLE_FORM'
}

export namespace Actions {

    export interface ClearQueryOverviewData extends Action<{
    }> {
        name:ActionName.ClearQueryOverviewData
    }

    export interface MainMenuOverviewShowQueryInfo extends Action<{

    }> {
        name:ActionName.MainMenuOverviewShowQueryInfo
    }

    export interface MainMenuOverviewShowQueryInfoDone extends Action<{
        Desc:Array<Kontext.QueryOperation>;
    }> {
        name:ActionName.MainMenuOverviewShowQueryInfoDone
    }

    export interface EditQueryOperation extends Action<{
        operationIdx:number;
        sourceId:string;
    }> {
        name:ActionName.EditQueryOperation
    }

    export interface EditLastQueryOperation extends Action<{
        sourceId:string;
    }> {
        name:ActionName.EditLastQueryOperation
    }

    export interface EditQueryOperationDone extends Action<{
        operationIdx:number;
        sourceId:string;
        data:AjaxResponse.ConcFormArgs;
    }> {
        name:ActionName.EditQueryOperationDone
    }

    export interface BranchQuery extends Action<{
        operationIdx:number;
    }> {
        name:ActionName.BranchQuery
    }

    export interface BranchQueryDone extends Action<{
        replayOperations:Array<string>;
        concArgsCache:{[key:string]:AjaxResponse.ConcFormArgs};
    }> {
        name:ActionName.BranchQueryDone
    }

    export interface QuerySetStopAfterIdx extends Action<{
        value:number;
    }> {
        name:ActionName.QuerySetStopAfterIdx;
    }

    export interface RedirectToEditQueryOperation extends Action<{
        operationIdx:number;
    }> {
        name:ActionName.RedirectToEditQueryOperation;
    }

    export interface QueryOverviewEditorClose extends Action<{
    }> {
        name:ActionName.QueryOverviewEditorClose;
    }

    export interface LockQueryPipeline extends Action<{
    }> {
        name:ActionName.LockQueryPipeline;
    }

    export interface QueryInputUnhitVirtualKeyboardKey extends Action<{
    }> {
        name:ActionName.QueryInputUnhitVirtualKeyboardKey;
    }

    export interface QueryInputHitVirtualKeyboardKey extends Action<{
        keyCode:number;
    }> {
        name:ActionName.QueryInputHitVirtualKeyboardKey;
    }

    export interface QueryInputSetVirtualKeyboardLayout extends Action<{
        idx:number;
    }> {
        name:ActionName.QueryInputSetVirtualKeyboardLayout;
    }

    export interface QueryInputToggleVirtualKeyboardShift extends Action<{
    }> {
        name:ActionName.QueryInputToggleVirtualKeyboardShift;
    }

    export interface QueryInputUnhitVirtualKeyboardShift extends Action<{
    }> {
        name:ActionName.QueryInputUnhitVirtualKeyboardShift;
    }

    export interface QueryInputToggleVirtualKeyboardCaps extends Action<{
    }> {
        name:ActionName.QueryInputToggleVirtualKeyboardCaps;
    }

    export interface QueryInputSelectContextFormItem extends Action<{
        name:string;
        value:any;
    }> {
        name:ActionName.QueryInputSelectContextFormItem;
    }

    export interface QueryContextToggleForm extends Action<{
    }> {
        name:ActionName.QueryContextToggleForm;
    }

    export interface QueryTextTypesToggleForm extends Action<{
    }> {
        name:ActionName.QueryTextTypesToggleForm;
    }
}