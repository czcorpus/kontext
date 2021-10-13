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

import { HTTP } from 'cnc-tskit';
import { IFullActionControl, StatefulModel } from 'kombo';
import { Observable, throwError } from 'rxjs';
import { PageModel } from '../../app/page';
import * as Kontext from '../../types/kontext';
import * as TextTypes from '../../types/textTypes';
import { TextTypesModel } from '../textTypes/main';

export type InputMode = 'gui'|'within';

export interface BaseSubcorpFormState {
    subcname:Kontext.FormValue<string>;
    description:Kontext.FormValue<string>;
    otherValidationError:Error|null;
}

interface SubmitBase {
    corpname:string;
    subcname:string;
    publish:boolean;
    description:string;
}

export interface CreateSubcorpusArgs extends SubmitBase {
    text_types:TextTypes.ExportedSelection;
    aligned_corpora:Array<string>;
    form_type:'tt-sel';
}

export interface CreateSubcorpusWithinArgs extends SubmitBase {
    within:Array<{
        negated:boolean;
        structure_name:string;
        attribute_cql:string;
    }>;
    form_type:'within';
}

export interface CreateSubcorpusRawCQLArgs extends SubmitBase {
    cql:string;
    form_type:'cql';
}


export interface ServerSubcorpListItem {
    deleted:boolean;
    usesubcorp:string;
    orig_subcname:string;
    created:number;
    cql:string;
    cqlAvailable:boolean;
    human_corpname:string;
    corpname:string;
    size:number;
    name:string;
    published:boolean;
    description:string;
}

export interface SubcorpList extends Kontext.AjaxResponse {
    SubcorpList:Array<any>; // TODO - do we need this?
    subcorp_list:Array<ServerSubcorpListItem>;
    filter:{[k:string]:any};
    sort_key:{name:string; reverse:boolean};
    related_corpora:Array<string>,
    processed_subc:Array<Kontext.AsyncTaskInfo>;
}

export interface CreateSubcorpus extends Kontext.AjaxResponse {
    processed_subc:Array<Kontext.AsyncTaskInfo>;
}

export class BaseTTSubcorpFormModel<T, U = {}> extends StatefulModel<T, U> {

    readonly pageModel:PageModel;

    readonly textTypesModel:TextTypesModel;

    constructor(
        dispatcher: IFullActionControl,
        pageModel: PageModel,
        textTypesModel: TextTypesModel,
        initState: T
    ) {
        super(
            dispatcher,
            initState
        );
        this.pageModel = pageModel;
        this.textTypesModel = textTypesModel;
    }

    submit(args:CreateSubcorpusArgs, validator: (args) => Error|null):Observable<any> {
        const err = validator(args);
        if (!err) {
            return this.pageModel.ajax$<any>(
                HTTP.Method.POST,
                this.pageModel.createActionUrl(
                    '/subcorpus/create',
                    {format: 'json'}
                ),
                args,
                {
                    contentType: 'application/json'
                }
            );

        } else {
            return throwError(err);
        }
    }
}