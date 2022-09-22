/*
 * Copyright (c) 2018 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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

import { HTTP, List } from 'cnc-tskit';
import { IFullActionControl, StatefulModel } from 'kombo';
import { Observable, throwError } from 'rxjs';
import { PageModel } from '../../app/page';
import * as Kontext from '../../types/kontext';
import * as TextTypes from '../../types/textTypes';
import { TTInitialData } from '../textTypes/common';
import { SubcorpListItem } from './list';


export interface SubcorpusServerRecord {
    id:string;
    name:string;
    corpus_name:string;
    user_id:number;
    author_id:number;
    author_fullname:string;
    size:number;
    is_draft:number;
    created:number;
    archived:number|undefined;
    published:number|undefined;
    public_description:string|undefined;
    public_description_raw:string|undefined;
    cql:string|undefined;
    within_cond:Array<ServerWithinSelection>|undefined;
    text_types:TextTypes.ExportedSelection|undefined;
}

export interface SubcorpusPropertiesResponse {
    data:SubcorpusServerRecord;
    textTypes:TTInitialData;
    structsAndAttrs:Kontext.StructsAndAttrs;
    liveAttrsEnabled:boolean;
}


export interface WithinSelection {
    negated:boolean;
    structureName:string;
    attributeCql:string;
}

export type SelectionsType = string|TextTypes.ExportedSelection|Array<ServerWithinSelection>|undefined;

export interface SubcorpusRecord {

    corpname:string;
    usesubcorp:string;
    name:string;
    created:number;
    archived:number|undefined;
    published:number|undefined;
    selections:SelectionsType;
    size:number;
    isDraft:boolean;
    description:string|undefined;
    descriptionRaw:string|undefined;
    authorId:number;
    authorFullname:string;
}

export function subcServerRecord2SubcorpusRecord(srec:SubcorpusServerRecord):SubcorpusRecord {
    return {
        corpname: srec.corpus_name,
        usesubcorp: srec.id,
        name: srec.name,
        created: srec.created,
        archived: srec.archived,
        published: srec.published,
        selections: srec.text_types ||
            srec.within_cond ||
            srec.cql,
        size: srec.size,
        isDraft: srec.is_draft === 1 ? true : false,
        description: srec.public_description,
        descriptionRaw: srec.public_description_raw,
        authorId: srec.author_id,
        authorFullname: srec.author_fullname
    };
}

export function isCQLSelection(selections:SelectionsType): selections is string {
    return typeof selections === "string";
}

export function isServerWithinSelection(selections:SelectionsType): selections is Array<ServerWithinSelection> {
    return selections instanceof Array;
}

export function isTTSelection(selections:SelectionsType): selections is TextTypes.ExportedSelection {
    return !isServerWithinSelection(selections) && selections instanceof Object;
}

export type FormType = 'tt-sel'|'within'|'cql';

export function getFormTypeFromSelection(selections:SelectionsType): FormType {
    if (isTTSelection(selections)) return 'tt-sel';
    else if (isServerWithinSelection(selections)) return 'within';
    else return 'cql';
}


export interface BaseSubcorpFormState {
    subcname:Kontext.FormValue<string>;
    description:Kontext.FormValue<string>;
    otherValidationError:Error|null;
}


interface SubmitBase {
    corpname:string;
    subcname:string;
    description:string;
}


export interface CreateSubcorpusArgs extends SubmitBase {
    text_types:TextTypes.ExportedSelection;
    aligned_corpora:Array<string>;
    usesubcorp?:string; // if used then we expect the referred subc. to be a draft (= mutable subc.)
    form_type:'tt-sel';
}

export interface ServerWithinSelection {
    negated:boolean;
    structure_name:string;
    attribute_cql:string;
}

export interface CreateSubcorpusWithinArgs extends SubmitBase {
    within:Array<ServerWithinSelection>;
    form_type:'within';
}


export interface CreateSubcorpusRawCQLArgs extends SubmitBase {
    cql:string;
    aligned_corpora:Array<string>;
    form_type:'cql';
}


export interface SubcorpList extends Kontext.AjaxResponse {
    subcorp_list:Array<SubcorpusServerRecord>;
    filter:{[k:string]:any};
    sort_key:{name:string; reverse:boolean};
    related_corpora:Array<string>,
    processed_subc:Array<Kontext.AsyncTaskInfo>;
    total_pages:number;
}


export interface CreateSubcorpus extends Kontext.AjaxResponse {
    processed_subc:Array<Kontext.AsyncTaskInfo>;
}

export function importServerSubcList(data:Array<SubcorpusServerRecord>):Array<SubcorpListItem> {
    return List.map(item => ({
        id: item.id,
        name: item.name,
        corpus_name: item.corpus_name,
        author_fullname: item.author_fullname,
        size: item.size,
        is_draft: item.is_draft === 1 ? true : false,
        created: new Date(item.created * 1000),
        archived: item.archived ? new Date(item.archived * 1000) : undefined,
        selected: false,
        published: item.published ? new Date(item.published * 1000) : undefined,
        public_description: item.public_description,
    }), data);
}

/**
 * Arguments common for both "gui" and "within" modes.
 * This is mainly used by "within" model to obtain common
 * args handled by SubcorpForm model.
 */
export interface CommonSubcorpFormArgs {
    corpname:string;
    subcname:string;
    description:string;
}


export class BaseTTSubcorpFormModel<T, U = {}> extends StatefulModel<T, U> {

    protected readonly pageModel:PageModel;

    constructor(
        dispatcher: IFullActionControl,
        pageModel: PageModel,
        initState: T
    ) {
        super(
            dispatcher,
            initState
        );
        this.pageModel = pageModel;
    }

    submit(
        args:CreateSubcorpusArgs|CreateSubcorpusWithinArgs,
        validator: (args) => Error|null
    ):Observable<any> {

        const err = validator(args);
        if (!err) {
            return this.pageModel.ajax$<CreateSubcorpus>(
                HTTP.Method.POST,
                this.pageModel.createActionUrl(
                    '/subcorpus/create',
                    {
                        format: 'json'
                    }
                ),
                args,
                {
                    contentType: 'application/json'
                }
            );

        } else {
            return throwError(() => err);
        }
    }
}

export type MultipleSubc<T = {}> = Array<{corpname:string; subcname:string} & {[P in keyof T]:T[keyof T]} >;


export function createSelectId(corpusName:string, subcorpId:string):string {
    return `${corpusName}:${subcorpId}`;
}


export function splitSelectId(selectId:string):[string, string] {
    const temp = selectId.split(':', 2);
    return [temp[0], temp[1]]
}


export function wipeSubcorpora(
    layoutModel:PageModel,
    items:MultipleSubc
):Observable<{num_wiped:number}> {
    return layoutModel.ajax$<{num_wiped:number}>(
        HTTP.Method.POST,
        layoutModel.createActionUrl('subcorpus/delete'),
        {
            items
        },
        {contentType: 'application/json'}
    );
}



export function archiveSubcorpora(
    layoutModel:PageModel,
    items:Array<{corpname:string; subcname:string}>
) {
    return layoutModel.ajax$<{archived: MultipleSubc<{archived: number}>}>(
        HTTP.Method.POST,
        layoutModel.createActionUrl('subcorpus/archive'),
        {
            items
        },
        {contentType: 'application/json'}
    );
}
