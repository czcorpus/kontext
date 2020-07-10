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
import { WithinBuilderData, QueryType, QueryContextArgs } from './common';


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
    QueryContextFormPrepareArgsDone = 'QUERY_CONTEXT_FORM_PREPARE_ARGS_DONE',
    QueryContextToggleForm = 'QUERY_CONTEXT_TOGGLE_FORM',
    QueryTextTypesToggleForm = 'QUERY_TEXT_TYPES_TOGGLE_FORM',
    LoadWithinBuilderData = 'QUERY_INPUT_LOAD_WITHIN_BUILDER_DATA',
    LoadWithinBuilderDataDone = 'QUERY_INPUT_LOAD_WITHIN_BUILDER_DATA_DONE',
    SetWithinValue = 'QUERY_INPUT_SET_WITHIN_VALUE',
    SetWithinAttr = 'QUERY_INPUT_SET_WITHIN_ATTR',
    SetActiveInputWidget = 'QUERY_INPUT_SET_ACTIVE_WIDGET',
    CQLEditorDisable = 'CQL_EDITOR_DISABLE',
    QueryInputSelectType = 'QUERY_INPUT_SELECT_TYPE',
    QueryInputSelectSubcorp = 'QUERY_INPUT_SELECT_SUBCORP',
    QueryInputMoveCursor = 'QUERY_INPUT_MOVE_CURSOR',
    QueryInputSetQuery = 'QUERY_INPUT_SET_QUERY',
    QueryInputAppendQuery = 'QUERY_INPUT_APPEND_QUERY',
    QueryInputRemoveLastChar = 'QUERY_INPUT_REMOVE_LAST_CHAR',
    QueryInputSetLpos = 'QUERY_INPUT_SET_LPOS',
    QueryInputSetMatchCase = 'QUERY_INPUT_SET_MATCH_CASE',
    QueryInputSetDefaultAttr = 'QUERY_INPUT_SET_DEFAULT_ATTR',
    QueryInputAddAlignedCorpus = 'QUERY_INPUT_ADD_ALIGNED_CORPUS',
    QueryInputRemoveAlignedCorpus = 'QUERY_INPUT_REMOVE_ALIGNED_CORPUS',
    FilterInputSetPCQPosNeg = 'QUERY_INPUT_SET_PCQ_POS_NEG',
    FilterInputSetFilfl = 'FILTER_QUERY_SET_FILFL',
    FilterInputSetRange = 'FILTER_QUERY_SET_RANGE',
    FilterInputSetInclKwic = 'FILTER_QUERY_SET_INCL_KWIC',
    QueryInputSetIncludeEmpty = 'QUERY_INPUT_SET_INCLUDE_EMPTY',
    QueryInputMakeCorpusPrimary = 'QUERY_MAKE_CORPUS_PRIMARY',
    QuerySubmit = 'QUERY_INPUT_SUBMIT',
    CorpusSwitchModelRestore = 'CORPUS_SWITCH_MODEL_RESTORE',
    ApplyFilter = 'FILTER_QUERY_APPLY_FILTER',
    FilterFirstHitsSubmit = 'FILTER_FIRST_HITS_SUBMIT',
    ToggleQueryHistoryWidget = 'QUERY_INPUT_TOGGLE_QUERY_HISTORY_WIDGET',
    SampleFormSetRlines = 'SAMPLE_FORM_SET_RLINES',
    SampleFormSubmit = 'SAMPLE_FORM_SUBMIT',
    SwitchMcFormSubmit = 'SWITCH_MC_FORM_SUBMIT'
}

export interface CorpusSwitchModelRestorePayload<T> {
    key:string;
    data:T,
    prevCorpora:Array<string>;
    currCorpora:Array<string>;
}

export type QueryFormType = Kontext.ConcFormTypes.QUERY|Kontext.ConcFormTypes.FILTER;

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

    export interface QueryContextFormPrepareArgsDone extends Action<{
        data:QueryContextArgs;
    }> {
        name:ActionName.QueryContextFormPrepareArgsDone;
    }

    export interface QueryContextToggleForm extends Action<{
    }> {
        name:ActionName.QueryContextToggleForm;
    }

    export interface QueryTextTypesToggleForm extends Action<{
    }> {
        name:ActionName.QueryTextTypesToggleForm;
    }

    export interface LoadWithinBuilderData extends Action<{
        sourceId:string;
    }> {
        name:ActionName.LoadWithinBuilderData;
    }

    export interface LoadWithinBuilderDataDone extends Action<{
        data:WithinBuilderData;
    }> {
        name:ActionName.LoadWithinBuilderDataDone;
    }

    export interface SetWithinValue extends Action<{
        value:string;
    }> {
        name:ActionName.SetWithinValue;
    }

    export interface SetWithinAttr extends Action<{
        idx:number;
    }> {
        name:ActionName.SetWithinAttr;
    }

    export interface SetActiveInputWidget extends Action<{
        formType:QueryFormType;
        sourceId:string;
        value:string;
        widgetArgs:{[key:string]:string|number|boolean};
    }> {
        name:ActionName.SetActiveInputWidget;
    }

    export interface CQLEditorDisable extends Action<{
    }> {
        name:ActionName.CQLEditorDisable;
    }

    export interface QueryInputSelectType extends Action<{
        formType:QueryFormType;
        sourceId:string;
        queryType:QueryType;
    }> {
        name:ActionName.QueryInputSelectType;
    }

    export interface QueryInputSelectSubcorp extends Action<{
        pubName:string;
        subcorp:string;
        foreign:boolean;
    }> {
        name:ActionName.QueryInputSelectSubcorp;
    }

    export interface QueryInputMoveCursor extends Action<{
        formType:QueryFormType;
        sourceId:string;
        rawAnchorIdx:number;
        rawFocusIdx:number;
    }> {
        name:ActionName.QueryInputMoveCursor;
    }

    export interface QueryInputSetQuery extends Action<{
        formType:QueryFormType;
        sourceId:string;
        query:string;
        insertRange:[number, number]|null;
        rawAnchorIdx:number;
        rawFocusIdx:number;
    }> {
        name:ActionName.QueryInputSetQuery;
    }

    export interface QueryInputAppendQuery extends Action<{
        formType:QueryFormType;
        sourceId:string;
        query:string;
        prependSpace:boolean;
        closeWhenDone:boolean;
        triggeredKey?:[number, number];
    }> {
        name:ActionName.QueryInputAppendQuery;
    }

    export interface QueryInputRemoveLastChar extends Action<{
        formType:QueryFormType;
        sourceId:string;
    }> {
        name:ActionName.QueryInputRemoveLastChar;
    }

    export interface QueryInputSetLpos extends Action<{
        formType:QueryFormType;
        sourceId:string;
        lpos:string;
    }> {
        name:ActionName.QueryInputSetLpos;
    }

    export interface QueryInputSetMatchCase extends Action<{
        formType:QueryFormType;
        sourceId:string;
        value:boolean;
    }> {
        name:ActionName.QueryInputSetMatchCase;
    }

    export interface QueryInputSetDefaultAttr extends Action<{
        formType:QueryFormType;
        sourceId:string;
        value:string;
    }> {
        name:ActionName.QueryInputSetDefaultAttr;
    }

    export interface QueryInputAddAlignedCorpus extends Action<{
        corpname:string;
    }> {
        name:ActionName.QueryInputAddAlignedCorpus;
    }

    export interface QueryInputRemoveAlignedCorpus extends Action<{
        corpname:string;
    }> {
        name:ActionName.QueryInputRemoveAlignedCorpus;
    }

    export interface FilterInputSetPCQPosNeg extends Action<{
        filterId:string;
        value:'pos'|'neg';
    }> {
        name:ActionName.FilterInputSetPCQPosNeg;
    }

    export interface FilterInputSetFilfl extends Action<{
        filterId:string;
        value:string;
    }> {
        name:ActionName.FilterInputSetFilfl;
    }

    export interface FilterInputSetRange extends Action<{
        filterId:string;
        value:string;
        rangeId:string;
    }> {
        name:ActionName.FilterInputSetRange;
    }

    export interface FilterInputSetInclKwic extends Action<{
        filterId:string;
        value:boolean;
    }> {
        name:ActionName.FilterInputSetInclKwic;
    }

    export interface ApplyFilter extends Action<{
        filterId:string;
    }> {
        name:ActionName.ApplyFilter;
    }

    export interface QueryInputSetIncludeEmpty extends Action<{
        corpname:string;
        value:boolean;
    }> {
        name:ActionName.QueryInputSetIncludeEmpty;
    }

    export interface QueryInputMakeCorpusPrimary extends Action<{
        corpname:string;
    }> {
        name:ActionName.QueryInputMakeCorpusPrimary;
    }

    export interface QuerySubmit extends Action<{
    }> {
        name:ActionName.QuerySubmit;
    }

    export interface CorpusSwitchModelRestore<T={}> extends
            Action<CorpusSwitchModelRestorePayload<T>> {
        name:ActionName.CorpusSwitchModelRestore;
    }

    export interface FilterFirstHitsSubmit extends Action<{
        opKey:string;
    }> {
        name:ActionName.FilterFirstHitsSubmit;
    }

    export interface ToggleQueryHistoryWidget extends Action<{
        formType:QueryFormType;
    }> {
        name:ActionName.ToggleQueryHistoryWidget;
    }

    export interface SampleFormSetRlines extends Action<{
        value:string;
        sampleId:string;
    }> {
        name:ActionName.SampleFormSetRlines;
    }

    export interface SampleFormSubmit extends Action<{
        sampleId:string;
    }> {
        name:ActionName.SampleFormSubmit;
    }

    export interface SwitchMcFormSubmit extends Action<{
        operationId:string;
    }> {
        name:ActionName.SwitchMcFormSubmit;
    }
}