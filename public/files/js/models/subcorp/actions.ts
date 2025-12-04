/*
 * Copyright (c) 2020 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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
import { SubcListFilter } from './list.js';
import { FormType, SubcorpusRecord, ServerWithinSelection } from './common.js';
import * as TextTypes from '../../types/textTypes.js';
import { LoadDataResponse } from './listPublic.js';
import * as Kontext from '../../types/kontext.js';
import { TTInitialData } from '../textTypes/common.js';


export class Actions {

    static SortLines:Action<{
        colName:string;
        reverse:boolean;
    }> = {
        name: 'SUBCORP_LIST_SORT_LINES'
    }

    static ArchiveSubcorpus:Action<{
        corpname:string;
        subcname:string;
    }> = {
        name: 'SUBCORP_LIST_ARCHIVE_SUBCORPUS'
    }

    static ArchiveSubcorpusDone:Action<{
        archived:Array<{
            corpname:string;
            subcname:string;
            archived:number
        }>;
    }> = {
        name: 'SUBCORP_LIST_ARCHIVE_SUBCORPUS_DONE'
    }

    static isArchiveSubcorpusDone(a:Action):a is typeof Actions.ArchiveSubcorpusDone {
        return a.name === Actions.ArchiveSubcorpusDone.name;
    }

    static UpdateFilter:Action<{
        filter:SubcListFilter;
        debounced:boolean;
    }> = {
        name: 'SUBCORP_LIST_UPDATE_FILTER'
    }

    static SetPage:Action<{
        page:string;
    }> = {
        name: 'SUBCORP_LIST_SET_PAGE'
    }

    static ShowSubcEditWindow:Action<{
        corpusName:string;
        subcorpusId:string;
        subcorpusName:string;
        bibIdAttr:string;
    }> = {
        name: 'SUBCORP_SHOW_SUBC_EDIT_WINDOW'
    }

    static LoadSubcorpus:Action<{
        corpname:string;
        usesubcorp:string;
    }> = {
        name: 'SUBCORP_LOAD_SUBCORPUS'
    }

    static LoadSubcorpusDone:Action<{
        corpname:string;
        subcname:string;
        data:SubcorpusRecord;
        textTypes:TTInitialData;
        structsAndAttrs:Kontext.StructsAndAttrs;
        liveAttrsEnabled:boolean;
        alignedSelection:Array<TextTypes.AlignedLanguageItem>;
    }> = {
        name: 'SUBCORP_LOAD_SUBCORPUS_DONE'
    }

    static HideSubcEditWindow:Action<{
    }> = {
        name: 'SUBCORP_HIDE_SUBC_EDIT_WINDOW'
    }

    static WipeSubcorpus:Action<{
    }> = {
        name: 'SUBCORP_LIST_WIPE_SUBCORPUS'
    }

    static WipeSubcorpusDone:Action<{
        numWiped:number;
    }> = {
        name: 'SUBCORP_LIST_WIPE_SUBCORPUS_DONE'
    }

    static isWipeSubcorpusDone(a:Action):a is typeof Actions.WipeSubcorpusDone {
        return a.name === Actions.WipeSubcorpusDone.name;
    }

    static RestoreSubcorpus:Action<{
    }> = {
        name: 'SUBCORP_LIST_RESTORE_SUBCORPUS'
    }

    static RestoreSubcorpusDone:Action<{
    }> = {
        name: 'SUBCORP_LIST_RESTORE_SUBCORPUS_DONE'
    }

    static ReuseQuery:Action<{
        selectionType:FormType;
        newName:string;
        usesubcorp?:string;
        asDraft?:boolean;
    }> = {
        name: 'SUBCORP_LIST_REUSE_QUERY'
    }

    static isReuseQuery(a:Action):a is typeof Actions.ReuseQuery {
        return a.name === Actions.ReuseQuery.name;
    }

    static ReuseQueryEmptyReady:Action<{
    }> = {
        name: 'SUBCORP_LIST_REUSE_EMPTY_READY'
    }

    static isReuseQueryEmptyReady(a:Action):a is typeof Actions.ReuseQueryEmptyReady {
        return a.name === Actions.ReuseQueryEmptyReady.name;
    }

    static ReuseQueryDone:Action<{
    }> = {
        name: 'SUBCORP_LIST_REUSE_QUERY_DONE'
    }

    static isReuseQueryDone(a:Action):a is typeof Actions.ReuseQueryDone {
        return a.name === Actions.ReuseQueryDone.name;
    }

    static UpdateDraft:Action<{
    }> = {
        name: 'SUBCORP_LIST_UPDATE_DRAFT'
    }

    static UpdateDraftDone:Action<{
    }> = {
        name: 'SUBCORP_LIST_UPDATE_DRAFT_DONE'
    }

    static UpdateSubcName:Action<{
        value:string;
    }> = {
        name: 'SUBCORP_LIST_UPDATE_NAME'
    }

    static UpdatePublicDescription:Action<{
        value:string;
    }> = {
        name: 'SUBCORP_LIST_UPDATE_PUBLIC_DESCRIPTION'
    };

    static TogglePublicDescription:Action<{
    }> = {
        name: 'SUBCORP_LIST_TOGGLE_PUBLIC_DESCRIPTION'
    }

    static SubmitNameAndPublicDescription:Action<{
    }> = {
        name: 'SUBCORP_LIST_NAME_AND_PUBLIC_DESCRIPTION_SUBMIT'
    }

    static SubmitNameAndPublicDescriptionDone:Action<{
        name:string;

        /**
         * Decoded Markdown description
         */
        preview:string;

        /**
         * if false then it means we requested only Markdown preview
         */
        saved:boolean;
    }> = {
        name: 'SUBCORP_LIST_NAME_AND_PUBLIC_DESCRIPTION_SUBMIT_DONE'
    }

    static isSubmitNameAndPublicDescriptionDone(a:Action):a is typeof Actions.SubmitNameAndPublicDescriptionDone {
        return a.name === Actions.SubmitNameAndPublicDescriptionDone.name;
    }

    static FormSetSubcName:Action<{
        value:string;
    }> = {
        name: 'SUBCORP_FORM_SET_SUBCNAME'
    }

    static FormSetInputMode:Action<{
        value:FormType;
    }> = {
        name: 'SUBCORP_FORM_SET_INPUT_MODE'
    }

    static FormSetDescription:Action<{
        value:string;
    }> = {
        name: 'SUBCORP_FORM_SET_DESCRIPTION'
    }

    static FormSubmit:Action<{
        selectionType:FormType;
        asDraft:boolean;
    }> = {
        name: 'SUBCORP_FORM_SUBMIT'
    }

    static FormWithinSubmitArgsReady:Action<{
        data:Array<ServerWithinSelection>;
        firstValidationError:string|undefined;
    }> = {
        name: 'SUBCORP_FORM_WITHIN_SUBMIT_ARGS_READY'
    }

    static isFormWithinSubmitArgsReady(a:Action):a is typeof Actions.FormWithinSubmitArgsReady {
        return a.name === Actions.FormWithinSubmitArgsReady.name;
    }

    static FormSetAlignedCorpora:Action<{
        alignedCorpora:Array<TextTypes.AlignedLanguageItem>;
    }> = {
        name: 'SUBCORP_FORM_SET_ALIGNED_CORPORA'
    }

    static SetSearchQuery:Action<{
        value:string;
        widgetId?:string;
    }> = {
        name: 'PUBSUBC_SET_SEARCH_QUERY'
    }

    static SubmitSearchQuery:Action<{
        query:string;
        widgetId?:string;
    }> = {
        name: 'PUBSUBC_SUBMIT_SEARCH_QUERY'
    }

    static DataLoadDone:Action<{
        data:LoadDataResponse;
        widgetId?:string;
    }> = {
        name: 'PUBSUBC_DATA_LOAD_DONE'
    }

    static UseInQuery:Action<{
        corpname:string;
        id:string;
    }> = {
        name: 'PUBSUBC_USE_IN_QUERY'
    }

    static PubSubcToggleOnlyCurrCorpus:Action<{
    }> = {
        name: 'PUBSUBC_TOGGLE_ONLY_CURR_CORPUS'
    }

    static FormWithinLineAdded:Action<{
        structureName:string;
        negated:boolean;
        attributeCql:string;
    }> = {
        name: 'SUBCORP_FORM_WITHIN_LINE_ADDED'
    }

    static FormWithinLineSetType:Action<{
        rowIdx:number;
        value:boolean;
    }> = {
        name: 'SUBCORP_FORM_WITHIN_LINE_SET_WITHIN_TYPE'
    }

    static FormWithinLineSetStruct:Action<{
        rowIdx:number;
        value:string;
    }> = {
        name: 'SUBCORP_FORM_WITHIN_LINE_SET_STRUCT'
    }

    static FormWithinLineSetCQL:Action<{
        rowIdx:number;
        value:string;
    }> = {
        name: 'SUBCORP_FORM_WITHIN_LINE_SET_CQL'
    };

    static FormWithinLineRemoved:Action<{
        rowIdx:number;
    }> = {
        name: 'SUBCORP_FORM_WITHIN_LINE_REMOVED'
    }

    static FormRawCQLSetValue:Action<{
        value:string;
    }> = {
        name: 'SUBCORP_FORM_RAW_CQL_SET_VALUE'
    }

    static FormShowRawWithinHint:Action<{
    }> = {
        name: 'SUBCORP_FORM_SHOW_RAW_WITHIN_HINT'
    }

    static FormHideRawWithinHint:Action<{
    }> = {
        name: 'SUBCORP_FORM_HIDE_RAW_WITHIN_HINT'
    }

    static QuickSubcorpSubmit:Action<{
    }> = {
        name: 'QUICK_SUBCORP_SUBMIT'
    }

    static QuickSubcorpSubmitDone:Action<{
    }> = {
        name: 'QUICK_SUBCORP_SUBMIT_DONE'
    }

    static QuickSubcorpChangeName:Action<{
        value:string;
    }> = {
        name: 'QUICK_SUBCORP_CHANGE_NAME'
    }

    static ToggleSelectLine:Action<{
        selectId:string;
    }> = {
        name: 'SUBCORP_LIST_TOGGLE_SELECT_LINE'
    }

    static ArchiveSelectedLines:Action<{
    }> = {
        name: 'SUBCORP_LIST_ARCHIVE_SELECTED_LINES'
    }

    static DeleteSelectedLines:Action<{
    }> = {
        name: 'SUBCORP_LIST_DELETE_SELECTED_LINES'
    }

    static ClearSelectedLines:Action<{
    }> = {
        name: 'SUBCORP_LIST_CLEAR_SELECTED_LINES'
    }

    static AttachTaskToSubcorpus:Action<{
        subcorpusId:string;
        task:Kontext.AsyncTaskInfo;
    }> = {
        name: 'SUBCORP_ATTACH_TASK_TO_SUBCORPUS'
    }
}