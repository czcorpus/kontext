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
import { InputMode } from './common';
import * as TextTypes from '../../types/textTypes';
import { LoadDataResponse } from './listPublic';


export class Actions {

    static SortLines:Action<{
        colName:string;
        reverse:boolean;
    }> = {
        name: 'SUBCORP_LIST_SORT_LINES'
    };

    static DeleteSubcorpus:Action<{
        rowIdx:number;
    }> = {
        name: 'SUBCORP_LIST_DELETE_SUBCORPUS'
    };

    static UpdateFilter:Action<SubcListFilter> = {
        name: 'SUBCORP_LIST_UPDATE_FILTER'
    };

    static ShowActionWindow:Action<{
        value:number;
        action:string;
    }> = {
        name: 'SUBCORP_LIST_SHOW_ACTION_WINDOW'
    };

    static HideActionWindow:Action<{
    }> = {
        name: 'SUBCORP_LIST_HIDE_ACTION_WINDOW'
    };

    static SetActionBoxType:Action<{
        value:string;
        row:number;
    }> = {
        name: 'SUBCORP_LIST_SET_ACTION_BOX_TYPE'
    };

    static WipeSubcorpus:Action<{
        idx:number;
    }> = {
        name: 'SUBCORP_LIST_WIPE_SUBCORPUS'
    };

    static RestoreSubcorpus:Action<{
        idx:number;
    }> = {
        name: 'SUBCORP_LIST_RESTORE_SUBCORPUS'
    };

    static ReuseQuery:Action<{
        idx:number;
        newName:string;
        newCql:string;
    }> = {
        name: 'SUBCORP_LIST_REUSE_QUERY'
    };

    static PublishSubcorpus:Action<{
        rowIdx:number;
        description:string;
    }> = {
        name: 'SUBCORP_LIST_PUBLISH_SUBCORPUS'
    };

    static UpdatePublicDescription:Action<{
        rowIdx:number;
        description:string;
    }> = {
        name: 'SUBCORP_LIST_UPDATE_PUBLIC_DESCRIPTION'
    };

    static SubmitPublicDescription:Action<{
        rowIdx:number;
    }> = {
        name: 'SUBCORP_LIST_PUBLIC_DESCRIPTION_SUBMIT'
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

    static FormSetSubcAsPublic:Action<{
        value:boolean;
    }> = {
        name: 'SUBCORP_FORM_SET_SUBC_AS_PUBLIC'
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
}