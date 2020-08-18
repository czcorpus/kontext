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
    EditQueryOperation = 'EDIT_QUERY_OPERATION',
    EditLastQueryOperation = 'EDIT_LAST_QUERY_OPERATION',
    EditQueryOperationDone = 'EDIT_QUERY_OPERATION_DONE',
    BranchQuery = 'BRANCH_QUERY',
    BranchQueryDone = 'BRANCH_QUERY_DONE',
    TrimQuery = 'TRIM_QUERY',
    QuerySetStopAfterIdx = 'QUERY_SET_STOP_AFTER_IDX',
    RedirectToEditQueryOperation = 'REDIRECT_TO_EDIT_QUERY_OPERATION',
    QueryOverviewEditorClose = 'QUERY_OVERVIEW_EDITOR_CLOSE',
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
    ApplyFilter = 'FILTER_QUERY_APPLY_FILTER',
    FilterFirstHitsSubmit = 'FILTER_FIRST_HITS_SUBMIT',
    ToggleQueryHistoryWidget = 'QUERY_INPUT_TOGGLE_QUERY_HISTORY_WIDGET',
    HideQuerySuggestionWidget = 'QUERY_INPUT_HIDE_QUERY_SUGGESTION_WIDGET',
    SampleFormSetRlines = 'SAMPLE_FORM_SET_RLINES',
    SampleFormSubmit = 'SAMPLE_FORM_SUBMIT',
    SwitchMcFormSubmit = 'SWITCH_MC_FORM_SUBMIT',
    CQLEditorInitialize = 'CQL_EDITOR_INITIALIZE',
    CQLEditorInitializeDone = 'CQL_EDITOR_INITIALIZE_DONE',
    CQLEditorEnable = 'CQL_EDITOR_ENABLE',
    CQLEditorDisable = 'CQL_EDITOR_DISABLE',
    SortSetActiveModel = 'SORT_SET_ACTIVE_STORE',
    SortFormSubmit = 'SORT_FORM_SUBMIT',
    SortFormSetSattr = 'SORT_FORM_SET_SATTR',
    SortFormSetSkey = 'SORT_FORM_SET_SKEY',
    SortFormSetSbward = 'SORT_FORM_SET_SBWARD',
    SortFormSetSicase = 'SORT_FORM_SET_SICASE',
    SortFormSetSpos = 'SORT_FORM_SET_SPOS',
    MLSortFormSubmit = 'ML_SORT_FORM_SUBMIT',
    MLSortFormAddLevel = 'ML_SORT_FORM_ADD_LEVEL',
    MLSortFormRemoveLevel = 'ML_SORT_FORM_REMOVE_LEVEL',
    MLSortFormSetSattr = 'ML_SORT_FORM_SET_SATTR',
    MLSortFormSetSicase = 'ML_SORT_FORM_SET_SICASE',
    MLSortFormSetSbward = 'ML_SORT_FORM_SET_SBWARD',
    MLSortFormSetCtx = 'ML_SORT_FORM_SET_CTX',
    MLSortFormSetCtxAlign = 'ML_SORT_FORM_SET_CTX_ALIGN',
    SaveAsFormSetName = 'QUERY_SAVE_AS_FORM_SET_NAME',
    SaveAsFormSubmit = 'QUERY_SAVE_AS_FORM_SUBMIT',
    SaveAsFormSubmitDone = 'QUERY_SAVE_AS_FORM_SUBMIT_DONE',
    GetConcArchivedStatus = 'QUERY_GET_CONC_ARCHIVED_STATUS',
    GetConcArchivedStatusDone = 'QUERY_GET_CONC_ARCHIVED_STATUS_DONE',
    MakeConcordancePermanent = 'QUERY_MAKE_CONCORDANCE_PERMANENT',
    MakeConcordancePermanentDone = 'QUERY_MAKE_CONCORDANCE_PERMANENT_DONE',
    StorageSetQueryType = 'QUERY_STORAGE_SET_QUERY_TYPE',
    StorageSetCurrentCorpusOnly = 'QUERY_STORAGE_SET_CURRENT_CORPUS_ONLY',
    StorageSetArchivedOnly = 'QUERY_STORAGE_SET_ARCHIVED_ONLY',
    StorageSetEditingQueryId = 'QUERY_STORAGE_SET_EDITING_QUERY_ID',
    StorageDoNotArchive = 'QUERY_STORAGE_DO_NOT_ARCHIVE',
    StorageEditorSetName = 'QUERY_STORAGE_EDITOR_SET_NAME',
    StorageEditorClickSave = 'QUERY_STORAGE_EDITOR_CLICK_SAVE',
    StorageClearEditingQueryID = 'QUERY_STORAGE_CLEAR_EDITING_QUERY_ID',
    StorageOpenQueryForm = 'QUERY_STORAGE_OPEN_QUERY_FORM',
    StorageLoadMore = 'QUERY_STORAGE_LOAD_MORE',
    QueryTaghelperPresetPattern = 'TAGHELPER_PRESET_PATTERN',
}

export type QueryFormType = Kontext.ConcFormTypes.QUERY|Kontext.ConcFormTypes.FILTER;

export namespace Actions {

    export interface ClearQueryOverviewData extends Action<{
    }> {
        name:ActionName.ClearQueryOverviewData
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

    export interface TrimQuery extends Action<{
        /*
         * an index of the last operation of the cut query chain
         */
        operationIdx:number;
    }> {
        name:ActionName.TrimQuery;
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

    export interface HideQuerySuggestionWidget extends Action<{
        formType:QueryFormType;
    }> {
        name:ActionName.HideQuerySuggestionWidget;
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

    export interface CQLEditorInitialize extends Action<{
    }> {
        name:ActionName.CQLEditorInitialize;
    }

    export interface CQLEditorInitializeDone extends Action<{
    }> {
        name:ActionName.CQLEditorInitializeDone;
    }

    export interface CQLEditorEnable extends Action<{
    }> {
        name:ActionName.CQLEditorEnable;
    }

    export interface CQLEditorDisable extends Action<{
    }> {
        name:ActionName.CQLEditorDisable;
    }

    export interface SortSetActiveModel extends Action<{
        sortId:string;
        formAction:string;
    }> {
        name:ActionName.SortSetActiveModel;
    }

    export interface SortFormSubmit extends Action<{
        sortId:string;
    }> {
        name:ActionName.SortFormSubmit;
    }

    export interface SortFormSetSattr extends Action<{
        sortId:string;
        value:string;
    }> {
        name:ActionName.SortFormSetSattr;
    }

    export interface SortFormSetSkey extends Action<{
        sortId:string;
        value:string;
    }> {
        name:ActionName.SortFormSetSkey;
    }

    export interface SortFormSetSbward extends Action<{
        sortId:string;
        value:string;
    }> {
        name:ActionName.SortFormSetSbward;
    }

    export interface SortFormSetSicase extends Action<{
        sortId:string;
        value:string;
    }> {
        name:ActionName.SortFormSetSicase;
    }

    export interface SortFormSetSpos extends Action<{
        sortId:string;
        value:string;
    }> {
        name:ActionName.SortFormSetSpos;
    }

    export interface MLSortFormSubmit extends Action<{
        sortId:string;
    }> {
        name:ActionName.MLSortFormSubmit;
    }

    export interface MLSortFormAddLevel extends Action<{
        sortId:string;
    }> {
        name:ActionName.MLSortFormAddLevel;
    }

    export interface MLSortFormRemoveLevel extends Action<{
        sortId:string;
        levelIdx:number;
    }> {
        name:ActionName.MLSortFormRemoveLevel;
    }

    export interface MLSortFormSetSattr extends Action<{
        sortId:string;
        levelIdx:number;
        value:string;
    }> {
        name:ActionName.MLSortFormSetSattr;
    }

    export interface MLSortFormSetSicase extends Action<{
        sortId:string;
        levelIdx:number;
        value:string;
    }> {
        name:ActionName.MLSortFormSetSicase;
    }

    export interface MLSortFormSetSbward extends Action<{
        sortId:string;
        levelIdx:number;
        value:string;
    }> {
        name:ActionName.MLSortFormSetSbward;
    }

    export interface MLSortFormSetCtxAlign extends Action<{
        sortId:string;
        levelIdx:number;
        value:string;
    }> {
        name:ActionName.MLSortFormSetCtxAlign;
    }

    export interface MLSortFormSetCtx extends Action<{
        sortId:string;
        levelIdx:number;
        index:number;
    }> {
        name:ActionName.MLSortFormSetCtx;
    }

    export interface SaveAsFormSetName extends Action<{
        value:string;
    }> {
        name:ActionName.SaveAsFormSetName
    }

    export interface SaveAsFormSubmit extends Action<{
    }> {
        name:ActionName.SaveAsFormSubmit
    }

    export interface SaveAsFormSubmitDone extends Action<{
    }> {
        name:ActionName.SaveAsFormSubmitDone
    }

    export interface GetConcArchivedStatus extends Action<{
    }> {
        name:ActionName.GetConcArchivedStatus
    }

    export interface GetConcArchivedStatusDone extends Action<{
        isArchived:boolean;
    }> {
        name:ActionName.GetConcArchivedStatusDone
    }

    export interface MakeConcordancePermanent extends Action<{
        revoke:boolean;
    }> {
        name:ActionName.MakeConcordancePermanent
    }

    export interface MakeConcordancePermanentDone extends Action<{
        revoked:boolean;
    }> {
        name:ActionName.MakeConcordancePermanentDone
    }

    export interface StorageSetQueryType extends Action<{
        value:string;
    }> {
        name:ActionName.StorageSetQueryType;
    }

    export interface StorageSetCurrentCorpusOnly extends Action<{
        value:boolean;
    }> {
        name:ActionName.StorageSetCurrentCorpusOnly;
    }

    export interface StorageSetArchivedOnly extends Action<{
        value:boolean;
    }> {
        name:ActionName.StorageSetArchivedOnly;
    }

    export interface StorageSetEditingQueryId extends Action<{
        value:string;
    }> {
        name:ActionName.StorageSetEditingQueryId;
    }

    export interface StorageDoNotArchive extends Action<{
        queryId:string;
    }> {
        name:ActionName.StorageDoNotArchive;
    }

    export interface StorageEditorSetName extends Action<{
        value:string;
    }> {
        name:ActionName.StorageEditorSetName;
    }

    export interface StorageEditorClickSave extends Action<{
    }> {
        name:ActionName.StorageEditorClickSave;
    }

    export interface StorageClearEditingQueryID extends Action<{
    }> {
        name:ActionName.StorageClearEditingQueryID;
    }

    export interface StorageOpenQueryForm extends Action<{
        idx:number;
    }> {
        name:ActionName.StorageOpenQueryForm;
    }

    export interface StorageLoadMore extends Action<{
    }> {
        name:ActionName.StorageLoadMore;
    }

    /**
     * This is an action a tag-helper plug-in should be able to respond to
     */
    export interface QueryTaghelperPresetPattern extends Action<{
        sourceId:string;
        pattern:string;
    }> {
        name:ActionName.QueryTaghelperPresetPattern;
    }
}