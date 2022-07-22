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
import { SubcListFilter } from './list';
import { FormWithinSubmitCommonArgs, InputMode, SubcorpusRecord } from './common';
import * as TextTypes from '../../types/textTypes';
import { LoadDataResponse } from './listPublic';
import * as Kontext from '../../types/kontext';
import { TTInitialData } from '../textTypes/common';


export class Actions {

    static SortLines:Action<{
        colName:string;
        reverse:boolean;
    }> = {
        name: 'SUBCORP_LIST_SORT_LINES'
    };

    static ArchiveSubcorpus:Action<{
        rowIdx:number;
    }> = {
        name: 'SUBCORP_LIST_DELETE_SUBCORPUS'
    };

    static UpdateFilter:Action<SubcListFilter> = {
        name: 'SUBCORP_LIST_UPDATE_FILTER'
    };

    static ShowSubcEditWindow:Action<{
        corpname:string;
        subcname:string;
    }> = {
        name: 'SUBCORP_SHOW_SUBC_EDIT_WINDOW'
    };

    static LoadSubcorpus:Action<{
        corpname:string;
        subcname:string;
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
    }> = {
        name: 'SUBCORP_LOAD_SUBCORPUS_DONE'
    }

    static HideSubcEditWindow:Action<{
    }> = {
        name: 'SUBCORP_HIDE_SUBC_EDIT_WINDOW'
    };

    static WipeSubcorpus:Action<{
    }> = {
        name: 'SUBCORP_LIST_WIPE_SUBCORPUS'
    };

    static WipeSubcorpusDone:Action<{
    }> = {
        name: 'SUBCORP_LIST_WIPE_SUBCORPUS_DONE'
    };

    static RestoreSubcorpus:Action<{
    }> = {
        name: 'SUBCORP_LIST_RESTORE_SUBCORPUS'
    };

    static RestoreSubcorpusDone:Action<{
    }> = {
        name: 'SUBCORP_LIST_RESTORE_SUBCORPUS_DONE'
    };

    static ReuseQuery:Action<{
        newName:string;
        newCql:string;
    }> = {
        name: 'SUBCORP_LIST_REUSE_QUERY'
    };

    static ReuseQueryDone:Action<{
    }> = {
        name: 'SUBCORP_LIST_REUSE_QUERY_DONE'
    };

    static PublishSubcorpus:Action<{
        description:string;
    }> = {
        name: 'SUBCORP_LIST_PUBLISH_SUBCORPUS'
    };

    static PublishSubcorpusDone:Action<{
        pubSubcname:string;
        published:boolean;
        description:string;
    }> = {
        name: 'SUBCORP_LIST_PUBLISH_SUBCORPUS_DONE'
    };

    static UpdatePublicDescription:Action<{
        description:string;
    }> = {
        name: 'SUBCORP_LIST_UPDATE_PUBLIC_DESCRIPTION'
    };

    static SubmitPublicDescription:Action<{
        rowIdx:number;
    }> = {
        name: 'SUBCORP_LIST_PUBLIC_DESCRIPTION_SUBMIT'
    };

    static SubmitPublicDescriptionDone:Action<{
        rowIdx:number;
    }> = {
        name: 'SUBCORP_LIST_PUBLIC_DESCRIPTION_SUBMIT_DONE'
    };

    static PublishItem:Action<{
        corpname:string;
        subcname:string;
    }> = {
        name: 'SUBCORP_LIST_PUBLISH_ITEM'
    };

    static FormSetSubcName:Action<{
        value:string;
    }> = {
        name: 'SUBCORP_FORM_SET_SUBCNAME'
    };

    static FormSetInputMode:Action<{
        value:InputMode;
    }> = {
        name: 'SUBCORP_FORM_SET_INPUT_MODE'
    };

    static FormSetDescription:Action<{
        value:string;
    }> = {
        name: 'SUBCORP_FORM_SET_DESCRIPTION'
    };

    static FormSubmit:Action<{
    }> = {
        name: 'SUBCORP_FORM_SUBMIT'
    };

    static FormWithinSubmit:Action<{
    }> = {
        name: 'SUBCORP_FORM_WITHIN_SUBMIT'
    };

    static FormWithinSubmitArgsReady:Action<FormWithinSubmitCommonArgs> = {
        name: 'SUBCORP_FORM_WITHIN_SUBMIT_ARGS_READY'
    };

    static isFormWithinSubmitArgsReady(a:Action):a is typeof Actions.FormWithinSubmitArgsReady {
        return a.name === Actions.FormWithinSubmitArgsReady.name;
    }

    static FormSetAlignedCorpora:Action<{
        alignedCorpora:Array<TextTypes.AlignedLanguageItem>;
    }> = {
        name: 'SUBCORP_FORM_SET_ALIGNED_CORPORA'
    };

    static SetSearchQuery:Action<{
        value:string;
    }> = {
        name: 'PUBSUBC_SET_SEARCH_QUERY'
    };

    static SubmitSearchQuery:Action<{
        query:string;
    }> = {
        name: 'PUBSUBC_SUBMIT_SEARCH_QUERY'
    };

    static DataLoadDone:Action<{
        data:LoadDataResponse;
    }> = {
        name: 'PUBSUBC_DATA_LOAD_DONE'
    };

    static UseInQuery:Action<{
        corpname:string;
        id:string;
    }> = {
        name: 'PUBSUBC_USE_IN_QUERY'
    };

    static FormWithinLineAdded:Action<{
        structureName:string;
        negated:boolean;
        attributeCql:string;
    }> = {
        name: 'SUBCORP_FORM_WITHIN_LINE_ADDED'
    };

    static FormWithinLineSetType:Action<{
        rowIdx:number;
        value:boolean;
    }> = {
        name: 'SUBCORP_FORM_WITHIN_LINE_SET_WITHIN_TYPE'
    };

    static FormWithinLineSetStruct:Action<{
        rowIdx:number;
        value:string;
    }> = {
        name: 'SUBCORP_FORM_WITHIN_LINE_SET_STRUCT'
    };

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
    };

    static FormShowRawWithinHint:Action<{
    }> = {
        name: 'SUBCORP_FORM_SHOW_RAW_WITHIN_HINT'
    };

    static FormHideRawWithinHint:Action<{
    }> = {
        name: 'SUBCORP_FORM_HIDE_RAW_WITHIN_HINT'
    };

    static QuickSubcorpSubmit:Action<{
    }> = {
        name: 'QUICK_SUBCORP_SUBMIT'
    };

    static QuickSubcorpChangeName: Action<{
        value: string;
    }> = {
        name: 'QUICK_SUBCORP_CHANGE_NAME'
    };
}