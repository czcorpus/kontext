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
import * as Kontext from '../../types/kontext';
import { WithinBuilderData, QueryContextArgs, CtxLemwordType } from './common';
import { ConcFormArgs } from './formArgs';
import { QueryType } from './query';


export type QueryFormType = Kontext.ConcFormTypes.QUERY | Kontext.ConcFormTypes.FILTER;

export class Actions {

    static ClearQueryOverviewData: Action<{
    }> = {
            name: 'CLEAR_QUERY_OVERVIEW_DATA'
        };

    static EditQueryOperation: Action<{
        operationIdx: number;
        sourceId: string;
    }> = {
            name: 'EDIT_QUERY_OPERATION'
        };

    static EditLastQueryOperation: Action<{
        sourceId: string;
    }> = {
            name: 'EDIT_LAST_QUERY_OPERATION'
        };

    static EditQueryOperationDone: Action<{
        operationIdx: number;
        sourceId: string;
        data: ConcFormArgs;
    }> = {
            name: 'EDIT_QUERY_OPERATION_DONE'
        };

    static BranchQuery: Action<{
        operationIdx: number;
    }> = {
            name: 'BRANCH_QUERY'
        };

    static TrimQuery: Action<{
        /*
         * an index of the last operation of the cut query chain
         */
        operationIdx: number;
    }> = {
            name: 'TRIM_QUERY'
        };

    static SliceQueryChain: Action<{
        operationIdx: number;
        concId: string;
    }> = {
            name: 'QUERY_REPLAY_SLICE_QUERY_CHAIN'
        };

    static QuerySetStopAfterIdx: Action<{
        value: number;
    }> = {
            name: 'QUERY_SET_STOP_AFTER_IDX'
        };

    static RedirectToEditQueryOperation: Action<{
        operationIdx: number;
    }> = {
            name: 'REDIRECT_TO_EDIT_QUERY_OPERATION'
        };

    static QueryOverviewEditorClose: Action<{
    }> = {
            name: 'QUERY_OVERVIEW_EDITOR_CLOSE'
        };

    static QueryInputUnhitVirtualKeyboardKey: Action<{
    }> = {
            name: 'QUERY_INPUT_UNHIT_VIRTUAL_KEYBOARD_KEY'
        };

    static QueryInputHitVirtualKeyboardKey: Action<{
        keyCode: number;
    }> = {
            name: 'QUERY_INPUT_HIT_VIRTUAL_KEYBOARD_KEY'
        };

    static QueryInputSetVirtualKeyboardLayout: Action<{
        idx: number;
    }> = {
            name: 'QUERY_INPUT_SET_VIRTUAL_KEYBOARD_LAYOUT'
        };

    static QueryInputToggleVirtualKeyboardShift: Action<{
    }> = {
            name: 'QUERY_INPUT_TOGGLE_VIRTUAL_KEYBOARD_SHIFT'
        };

    static QueryInputUnhitVirtualKeyboardShift: Action<{
    }> = {
            name: 'QUERY_INPUT_UNHIT_VIRTUAL_KEYBOARD_SHIFT'
        };

    static QueryInputToggleVirtualKeyboardCaps: Action<{
    }> = {
            name: 'QUERY_INPUT_TOGGLE_VIRTUAL_KEYBOARD_CAPS'
        };

    static QueryInputToggleVirtualKeyboardAltGr: Action<{
    }> = {
            name: 'QUERY_INPUT_TOGGLE_VIRTUAL_KEYBOARD_ALTGR'
        };

    static QueryInputHitVirtualKeyboardDeadKey: Action<{
        deadKeyIndex: number;
    }> = {
            name: 'QUERY_INPUT_HIT_VIRTUAL_KEYBOARD_DEAD_KEY'
        };

    static QueryContextSetLemwordWsize: Action<{
        value: [number, number];
    }> = {
            name: 'QUERY_CONTEXT_SET_LEMWORD_WSIZE'
        };

    static QueryContextSetLemword: Action<{
        value: string;
    }> = {
            name: 'QUERY_CONTEXT_SET_LEMWORD'
        };

    static QueryContextSetLemwordType: Action<{
        value: CtxLemwordType;
    }> = {
            name: 'QUERY_CONTEXT_SET_LEMWORD_TYPE'
        };

    static QueryContextSetPosWsize: Action<{
        value: [number, number];
    }> = {
            name: 'QUERY_CONTEXT_SET_POS_WSIZE'
        };

    static QueryContextSetPos: Action<{
        checked: boolean;
        value: string;
    }> = {
            name: 'QUERY_CONTEXT_SET_POS'
        };

    static QueryContextSetPosType: Action<{
        value: CtxLemwordType;
    }> = {
            name: 'QUERY_CONTEXT_SET_POS_TYPE'
        };

    static QueryContextFormPrepareArgsDone: Action<{
        data: QueryContextArgs;
    }> = {
            name: 'QUERY_CONTEXT_FORM_PREPARE_ARGS_DONE'
        };

    static QueryContextToggleForm: Action<{
    }> = {
            name: 'QUERY_CONTEXT_TOGGLE_FORM'
        };

    static QueryTextTypesToggleForm: Action<{
    }> = {
            name: 'QUERY_TEXT_TYPES_TOGGLE_FORM'
        };

    static QueryOptionsToggleForm: Action<{
        formType: QueryFormType;
        sourceId: string;
    }> = {
            name: 'QUERY_OPTIONS_TOGGLE_FORM'
        };

    static LoadWithinBuilderData: Action<{
        sourceId: string;
    }> = {
            name: 'QUERY_INPUT_LOAD_WITHIN_BUILDER_DATA'
        };

    static LoadWithinBuilderDataDone: Action<{
        data: WithinBuilderData;
    }> = {
            name: 'QUERY_INPUT_LOAD_WITHIN_BUILDER_DATA_DONE'
        };

    static SetWithinValue: Action<{
        value: string;
    }> = {
            name: 'QUERY_INPUT_SET_WITHIN_VALUE'
        };

    static SetWithinAttr: Action<{
        idx: number;
    }> = {
            name: 'QUERY_INPUT_SET_WITHIN_ATTR'
        };

    static SetActiveInputWidget: Action<{
        formType: QueryFormType;
        sourceId: string;
        corpname: string;
        value: string;
        appliedQueryRange: [number, number];
    }> = {
            name: 'QUERY_INPUT_SET_ACTIVE_WIDGET'
        };

    static QueryInputSetQType: Action<{
        formType: QueryFormType;
        sourceId: string;
        queryType: QueryType;
    }> = {
            name: 'QUERY_INPUT_SELECT_TYPE'
        };

    static QueryInputSelectSubcorp: Action<{
        pubName: string;
        subcorp: string;
        foreign: boolean;
    }> = {
            name: 'QUERY_INPUT_SELECT_SUBCORP'
        };

    static QueryInputMoveCursor: Action<{
        formType: QueryFormType;
        sourceId: string;
        rawAnchorIdx: number;
        rawFocusIdx: number;
    }> = {
            name: 'QUERY_INPUT_MOVE_CURSOR'
        };

    static QueryInputResetQueryExpansion: Action<{
        formType: QueryFormType;
        sourceId: string;
    }> = {
            name: 'QUERY_INPUT_RESET_QUERY_EXPANSION'
        };

    static QueryInputSetQuery: Action<{
        formType: QueryFormType;
        sourceId: string;
        query: string;
        insertRange: [number, number] | null;
        rawAnchorIdx: number | null;
        rawFocusIdx: number | null;
    }> = {
            name: 'QUERY_INPUT_SET_QUERY'
        };

    static QueryInputAppendQuery: Action<{
        formType: QueryFormType;
        sourceId: string;
        query: string;
        prependSpace: boolean;
        closeWhenDone: boolean;
        triggeredKey?: [number, number];
    }> = {
            name: 'QUERY_INPUT_APPEND_QUERY'
        };

    static QueryInputInsertAtCursor: Action<{
        formType: QueryFormType;
        sourceId: string;
        chunk: string;
    }> = {
            name: 'QUERY_INPUT_INSERT_AT_CURSOR'
        };

    static QueryInputRemoveLastChar: Action<{
        formType: QueryFormType;
        sourceId: string;
    }> = {
            name: 'QUERY_INPUT_REMOVE_LAST_CHAR'
        };

    static QueryInputSetLpos: Action<{
        formType: QueryFormType;
        sourceId: string;
        lpos: string;
    }> = {
            name: 'QUERY_INPUT_SET_LPOS'
        };

    static QueryInputSetMatchCase: Action<{
        formType: QueryFormType;
        sourceId: string;
        value: boolean;
    }> = {
            name: 'QUERY_INPUT_SET_MATCH_CASE'
        };

    static QueryInputSetDefaultAttr: Action<{
        formType: QueryFormType;
        sourceId: string;
        value: string;
    }> = {
            name: 'QUERY_INPUT_SET_DEFAULT_ATTR'
        };

    static QueryInputToggleAllowRegexp: Action<{
        formType: QueryFormType;
        sourceId: string;
        value: boolean;
    }> = {
            name: 'QUERY_INPUT_TOGGLE_ALLOW_REGEXP'
        };

    static QueryToggleAlignedCorpora: Action<{}> = {
        name: 'QUERY_TOGGLE_ALIGNED_CORPORA'
    };

    static QueryInputAddAlignedCorpus: Action<{
        corpname: string;
    }> = {
            name: 'QUERY_INPUT_ADD_ALIGNED_CORPUS'
        };

    static QueryInputRemoveAlignedCorpus: Action<{
        corpname: string;
    }> = {
            name: 'QUERY_INPUT_REMOVE_ALIGNED_CORPUS'
        };

    static QueryInputSetPCQPosNeg: Action<{
        formType: QueryFormType;
        sourceId: string;
        value: 'pos' | 'neg';
    }> = {
            name: 'QUERY_INPUT_SET_PCQ_POS_NEG'
        };

    static QueryInputSelectText: Action<{
        sourceId: string;
        formType: QueryFormType;
        anchorIdx: number;
        focusIdx: number;
    }> = {
            name: 'QUERY_INPUT_SELECT_TEXT'
        };

    static FilterInputSetFilfl: Action<{
        filterId: string;
        value: 'f' | 'l';
    }> = {
            name: 'FILTER_QUERY_SET_FILFL'
        };

    static FilterInputSetRange: Action<{
        filterId: string;
        value: string;
        rangeId: string;
    }> = {
            name: 'FILTER_QUERY_SET_RANGE'
        };

    static FilterInputSetInclKwic: Action<{
        filterId: string;
        value: boolean;
    }> = {
            name: 'FILTER_QUERY_SET_INCL_KWIC'
        };

    static FilterInputSetFilterType: Action<{
        filterId: string;
        value: 'p' | 'n';
    }> = {
            name: 'FILTER_INPUT_SET_FILTER_TYPE'
        };

    static ApplyFilter: Action<{
        filterId: string;
    }> = {
            name: 'FILTER_QUERY_APPLY_FILTER'
        };

    static QueryInputSetIncludeEmpty: Action<{
        corpname: string;
        value: boolean;
    }> = {
            name: 'QUERY_INPUT_SET_INCLUDE_EMPTY'
        };

    static QuerySubmit: Action<{
        noQueryHistory?: boolean;
    }> = {
            name: 'QUERY_INPUT_SUBMIT'
        };

    static FilterFirstHitsSubmit: Action<{
        opKey: string;
    }> = {
            name: 'FILTER_FIRST_HITS_SUBMIT'
        };

    static ToggleQuerySuggestionWidget: Action<{
        formType: QueryFormType;
        sourceId: string;
        tokenIdx: number | null;
    }> = {
            name: 'QUERY_INPUT_TOGGLE_QUERY_SUGGESTION_WIDGET'
        };

    static ShowQueryStructureWidget: Action<{
        formType: QueryFormType;
        sourceId: string;
    }> = {
            name: 'QUERY_INPUT_SHOW_QUERY_STRUCTURE_WIDGET'
        };

    static HideQueryStructureWidget: Action<{
        formType: QueryFormType;
        sourceId: string;
    }> = {
            name: 'QUERY_INPUT_HIDE_QUERY_STRUCTURE_WIDGET'
        };

    static SampleFormSetRlines: Action<{
        value: string;
        sampleId: string;
    }> = {
            name: 'SAMPLE_FORM_SET_RLINES'
        };

    static SampleFormSubmit: Action<{
        sampleId: string;
    }> = {
            name: 'SAMPLE_FORM_SUBMIT'
        };

    static SwitchMcFormSubmit: Action<{
        operationId: string;
    }> = {
            name: 'SWITCH_MC_FORM_SUBMIT'
        };

    static SortSetActiveModel: Action<{
        sortId: string;
        formAction: string;
    }> = {
            name: 'SORT_SET_ACTIVE_STORE'
        };

    static SortFormSubmit: Action<{
        sortId: string;
    }> = {
            name: 'SORT_FORM_SUBMIT'
        };

    static SortFormSetSattr: Action<{
        sortId: string;
        value: string;
    }> = {
            name: 'SORT_FORM_SET_SATTR'
        };

    static SortFormSetSkey: Action<{
        sortId: string;
        value: string;
    }> = {
            name: 'SORT_FORM_SET_SKEY'
        };

    static SortFormSetSbward: Action<{
        sortId: string;
        value: string;
    }> = {
            name: 'SORT_FORM_SET_SBWARD'
        };

    static SortFormSetSicase: Action<{
        sortId: string;
        value: string;
    }> = {
            name: 'SORT_FORM_SET_SICASE'
        };

    static SortFormSetSpos: Action<{
        sortId: string;
        value: string;
    }> = {
            name: 'SORT_FORM_SET_SPOS'
        };

    static MLSortFormSubmit: Action<{
        sortId: string;
    }> = {
            name: 'ML_SORT_FORM_SUBMIT'
        };

    static MLSortFormAddLevel: Action<{
        sortId: string;
    }> = {
            name: 'ML_SORT_FORM_ADD_LEVEL'
        };

    static MLSortFormRemoveLevel: Action<{
        sortId: string;
        levelIdx: number;
    }> = {
            name: 'ML_SORT_FORM_REMOVE_LEVEL'
        };

    static MLSortFormSetSattr: Action<{
        sortId: string;
        levelIdx: number;
        value: string;
    }> = {
            name: 'ML_SORT_FORM_SET_SATTR'
        };

    static MLSortFormSetSicase: Action<{
        sortId: string;
        levelIdx: number;
        value: string;
    }> = {
            name: 'ML_SORT_FORM_SET_SICASE'
        };

    static MLSortFormSetSbward: Action<{
        sortId: string;
        levelIdx: number;
        value: string;
    }> = {
            name: 'ML_SORT_FORM_SET_SBWARD'
        };

    static MLSortFormSetCtxAlign: Action<{
        sortId: string;
        levelIdx: number;
        value: string;
    }> = {
            name: 'ML_SORT_FORM_SET_CTX_ALIGN'
        };

    static MLSortFormSetCtx: Action<{
        sortId: string;
        levelIdx: number;
        index: number;
    }> = {
            name: 'ML_SORT_FORM_SET_CTX'
        };

    static SaveAsFormSetName: Action<{
        value: string;
    }> = {
            name: 'QUERY_SAVE_AS_FORM_SET_NAME'
        };

    static SaveAsFormSubmit: Action<{
    }> = {
            name: 'QUERY_SAVE_AS_FORM_SUBMIT'
        };

    static SaveAsFormSubmitDone: Action<{
    }> = {
            name: 'QUERY_SAVE_AS_FORM_SUBMIT_DONE'
        };

    static GetConcArchivedStatus: Action<{
    }> = {
            name: 'QUERY_GET_CONC_ARCHIVED_STATUS'
        };

    static GetConcArchivedStatusDone: Action<{
        isArchived: boolean;
        willBeArchived: boolean;
    }> = {
            name: 'QUERY_GET_CONC_ARCHIVED_STATUS_DONE'
        };

    static MakeConcordancePermanent: Action<{
        revoke: boolean;
    }> = {
            name: 'QUERY_MAKE_CONCORDANCE_PERMANENT'
        };

    static MakeConcordancePermanentDone: Action<{
        revoked: boolean;
    }> = {
            name: 'QUERY_MAKE_CONCORDANCE_PERMANENT_DONE'
        };

    /**
     * This is an action a tag-helper plug-in should be able to respond to
     */
    static QueryTaghelperPresetPattern: Action<{
        sourceId: string;
        tagsetId: string;
        formType: QueryFormType;
        pattern: string;
    }> = {
            name: 'TAGHELPER_PRESET_PATTERN'
        };
}

export function isSetActiveInputWidgetAction(a: Action): a is typeof Actions.SetActiveInputWidget {
    return a.name === Actions.SetActiveInputWidget.name;
}