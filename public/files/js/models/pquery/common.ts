/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
 * Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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

import { Dict, List, pipe, tuple } from 'cnc-tskit';
import { Kontext } from '../../types/common';
import { AdvancedQuery, AdvancedQuerySubmit } from '../query/query';

export interface PquerySubmitArgs {
    usesubcorp:string;
    min_freq:number;
    position:string;
    attr:string;
    queries:Array<AdvancedQuerySubmit>;
}

export type AttrIntersectionFreqs = {[word:string]:number};

export type PqueryResult = Array<[string, number]>;


export interface StoredPqueryForm {
    id:string;
    corpora:Array<string>,
    usesubcorp?:string;
    min_freq:number;
    position:string;
    attr:string;
    queries:Array<AdvancedQuerySubmit>;
    form_type:'pquery';
    persist_level:1;
}

export interface FreqIntersectionArgs {
    corpname:string;
    usesubcorp:string;
    source__and_conc_ids:Array<[string, string]>;
    min_freq:number;
    attr:string;
    position:string;
}

export interface AsyncTaskArgs {
    conc_id:string;
    source_id:string;
    last_update:number;
}

export interface FreqIntersectionResponse {
    tasks:Array<Kontext.AsyncTaskInfo<unknown>>;
}

export function asyncTaskIsPquery(t:Kontext.AsyncTaskInfo):t is Kontext.AsyncTaskInfo<AsyncTaskArgs> {
    return t.category === 'pquery' && t.args['conc_id'] !== undefined;
}

export type TaskStatus = 'none'|'running'|'finished';

export interface QueryCalcStatus {
    concId:string|undefined;
    startTs:number;
    finishTs:number|undefined;
    error:string|undefined;
    status:TaskStatus;
}

export function importTaskInfo(t:Kontext.AsyncTaskInfo<AsyncTaskArgs>):[string, QueryCalcStatus] {
    return tuple(
        t.args.source_id,
        {
            concId: t.args.conc_id,
            startTs: t.args.last_update,
            finishTs: undefined,
            error: t.error || undefined,
            status: t.status === 'STARTED' || t.status === 'PENDING' ?
                'running' : 'finished'
        }
    );
}

export interface PqueryFormModelState {
    isBusy:boolean;
    corpname:string;
    usesubcorp:string;
    queries:{[sourceId:string]:AdvancedQuery}; // pquery block -> query
    queriesCalc:{[sourceId:string]:QueryCalcStatus|undefined};
    minFreq:number;
    position:string;
    attr:string;
    attrs:Array<Kontext.AttrItem>;
    structAttrs:Array<Kontext.AttrItem>;
    receivedResults:boolean;
}

export function generatePqueryName(i:number):string {
    return `pqitem_${i}`;
}

export function newModelState(
    corpname:string,
    usesubcorp:string,
    attrs:Array<Kontext.AttrItem>,
    structAttrs:Array<Kontext.AttrItem>
):PqueryFormModelState {

    return {
        isBusy: false,
        corpname,
        usesubcorp,
        queries: {[generatePqueryName(0)]: {
            corpname,
            qtype: 'advanced',
            query: '',
            parsedAttrs: [],
            focusedAttr: undefined,
            rawAnchorIdx: 0,
            rawFocusIdx: 0,
            queryHtml: '',
            pcq_pos_neg: 'pos',
            include_empty: true,
            default_attr: null,
        }},
        queriesCalc: {[generatePqueryName(0)]: undefined},
        minFreq: 5,
        position: '0<0',
        attr: List.head(attrs).n,
        attrs,
        structAttrs,
        receivedResults: false
    };
}

export function storedQueryToModel(
    sq:StoredPqueryForm,
    attrs:Array<Kontext.AttrItem>,
    structAttrs:Array<Kontext.AttrItem>
):PqueryFormModelState {

    return {
        isBusy: false,
        corpname: List.head(sq.corpora),
        usesubcorp: sq.usesubcorp,
        queries: pipe(
            sq.queries,
            List.map<AdvancedQuerySubmit, [string, AdvancedQuery]>(
                (q, i) => tuple(
                    generatePqueryName(i),
                    {
                        corpname: q.corpname,
                        qtype: 'advanced',
                        query: q.query,
                        parsedAttrs: [],
                        focusedAttr: null,
                        rawAnchorIdx: 0,
                        rawFocusIdx: 0,
                        queryHtml: q.query, // TODO
                        pcq_pos_neg: 'pos',
                        include_empty: q.include_empty,
                        default_attr: q.default_attr
                    }
                )
            ),
            Dict.fromEntries()
        ),
        queriesCalc: pipe(
            sq.queries,
            List.map(
                (v, i) => tuple(generatePqueryName(i), undefined)
            ),
            Dict.fromEntries()
        ),
        minFreq: sq.min_freq,
        position: sq.position,
        attr: sq.attr,
        attrs,
        structAttrs,
        receivedResults: false
    }
}