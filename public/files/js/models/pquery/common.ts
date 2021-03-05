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
import { highlightSyntaxStatic } from '../query/cqleditor/parser';
import { AlignTypes } from '../freqs/twoDimension/common';
import { AdvancedQuery, AdvancedQuerySubmit } from '../query/query';

/**
 * PqueryFormArgs represents paradigmatic query form values
 * as stored on server. Due to specific nature of the whole
 * calculation process, the type is not used directly
 * to start a calculation.
 */
export interface PqueryFormArgs {
    id?:string; // if undefined then the form is not serialized yet
    corpname:string;
    usesubcorp:string;
    min_freq:number;
    posIndex:number;
    posAlign:AlignTypes;
    attr:string;
    queries:Array<AdvancedQuerySubmit>;
}

/**
 * PqueryResult is a result of a Paradigmatic query
 */
export type PqueryResult = Array<[string, number]>;


export interface FreqIntersectionArgs {
    corpname:string;
    usesubcorp:string;
    conc_ids:Array<string>;
    min_freq:number;
    attr:string;
    position:string;
}

export interface AsyncTaskArgs {
    conc_id:string;
    last_update:number;
}

export interface FreqIntersectionResponse {
    task:Kontext.AsyncTaskInfo<unknown>;
}

export function asyncTaskIsPquery(t:Kontext.AsyncTaskInfo):t is Kontext.AsyncTaskInfo<AsyncTaskArgs> {
    return t.category === 'pquery' && t.args['conc_id'] !== undefined;
}

export type ConcStatus = 'none'|'running'|'finished';



export interface PqueryFormModelState {
    isBusy:boolean;
    corpname:string;
    usesubcorp:string;
    queries:{[sourceId:string]:AdvancedQuery}; // pquery block -> query
    downArrowTriggersHistory:{[sourceId:string]:boolean};
    cqlEditorMessages:{[sourceId:string]:string};
    useRichQueryEditor:boolean;
    concWait:{[sourceId:string]:ConcStatus};
    queryId:string|undefined;
    task:Kontext.AsyncTaskInfo<AsyncTaskArgs>|undefined;
    minFreq:number;
    posIndex:number;
    posAlign:AlignTypes;
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
    structAttrs:Array<Kontext.AttrItem>,
    useRichQueryEditor:boolean
):PqueryFormModelState {

    return {
        isBusy: false,
        corpname,
        usesubcorp,
        queries: pipe(
            List.repeat<[string, AdvancedQuery]>(
                idx => tuple(
                    generatePqueryName(idx),
                    {
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
                    }
                ),
                2
            ),
            Dict.fromEntries()
        ),
        downArrowTriggersHistory: pipe(
            List.repeat(idx => tuple(generatePqueryName(idx), false), 2),
            Dict.fromEntries()
        ),
        cqlEditorMessages: pipe(
            List.repeat(idx => tuple(generatePqueryName(idx), ''), 2),
            Dict.fromEntries()
        ),
        useRichQueryEditor,
        concWait: pipe(
            List.repeat<[string, ConcStatus]>(idx => tuple(generatePqueryName(idx), 'none'), 2),
            Dict.fromEntries()
        ),
        task: undefined,
        queryId: undefined,
        minFreq: 5,
        posIndex: 6,
        posAlign: AlignTypes.LEFT,
        attr: List.head(attrs).n,
        attrs,
        structAttrs,
        receivedResults: false
    };
}

export function storedQueryToModel(
    sq:PqueryFormArgs,
    attrs:Array<Kontext.AttrItem>,
    structAttrs:Array<Kontext.AttrItem>,
    useRichQueryEditor:boolean
):PqueryFormModelState {

    return {
        isBusy: false,
        corpname: sq.corpname,
        usesubcorp: sq.usesubcorp,
        queries: pipe(
            sq.queries,
            List.map<AdvancedQuerySubmit, [string, AdvancedQuery]>(
                (query, i) => {
                    const [queryHtml, parsedAttrs] = highlightSyntaxStatic(
                        query.query,
                        'advanced',
                        {
                            translate: (s:string, values?:any) => s
                        }
                    );

                    return tuple(
                        generatePqueryName(i),
                        {
                            corpname: query.corpname,
                            qtype: 'advanced',
                            query: query.query,
                            parsedAttrs: parsedAttrs,
                            focusedAttr: null,
                            rawAnchorIdx: 0,
                            rawFocusIdx: 0,
                            queryHtml,
                            pcq_pos_neg: 'pos',
                            include_empty: query.include_empty,
                            default_attr: query.default_attr
                        }
                    )
                }
            ),
            Dict.fromEntries()
        ),
        downArrowTriggersHistory: pipe(
            sq.queries,
            List.map((q, i) => tuple(generatePqueryName(i), false)),
            Dict.fromEntries()
        ),
        cqlEditorMessages: pipe(
            sq.queries,
            List.map((q, i) => tuple(generatePqueryName(i), '')),
            Dict.fromEntries()
        ),
        useRichQueryEditor,
        concWait: pipe(
            sq.queries,
            List.map<AdvancedQuerySubmit, [string, ConcStatus]>(
                (v, i) => tuple(generatePqueryName(i), 'none')
            ),
            Dict.fromEntries()
        ),
        task: undefined,
        queryId: sq.id,
        minFreq: sq.min_freq,
        posIndex: sq.posIndex,
        posAlign: sq.posAlign,
        attr: sq.attr,
        attrs,
        structAttrs,
        receivedResults: false
    }
}