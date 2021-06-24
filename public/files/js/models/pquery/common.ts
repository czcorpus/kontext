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
import { highlightSyntaxStatic, ParsedAttr } from '../query/cqleditor/parser';
import { AlignTypes } from '../freqs/twoDimension/common';
import { AdvancedQuery, AdvancedQuerySubmit } from '../query/query';
import { AjaxResponse } from '../../types/ajaxResponses';


/**
 * PqueryResult is a result of a Paradigmatic query
 * The first item is the word, other items are individual absolute
 * frequencies of all the involved concordances.
 */
export type PqueryResult = Array<[string, ...number[]]>;


export interface FreqIntersectionArgs {
    corpname:string;
    usesubcorp:string;
    conc_ids:Array<string>;
    conc_subset_complement_ids:Array<string>;
    min_freq:number;
    attr:string;
    pos_left:number;
    pos_right:number;
    pos_align:AlignTypes|PqueryAlignTypes;
    position:string;
}

export interface StoredAdvancedQuery extends AdvancedQuerySubmit {
    conc_id:string;
}

export type ConcQueries = Array<StoredAdvancedQuery>;

export interface AsyncTaskArgs {
    query_id:string;
    last_update:number;
}

export interface FreqIntersectionResponse {
    task:Kontext.AsyncTaskInfo<unknown>;
}

export function asyncTaskIsPquery(t:Kontext.AsyncTaskInfo):t is Kontext.AsyncTaskInfo<AsyncTaskArgs> {
    return t.category === 'pquery' && t.args['conc_id'] !== undefined;
}

export type ConcStatus = 'none'|'running'|'finished';

export interface HistoryArgs {
    corpname:string;
    usesubcorp:string;
    queryId:string;
    sort:string;
    page:number;
}

export type InvolvedConcFormArgs = {[queryId:string]:AjaxResponse.QueryFormArgs};

export const enum PqueryAlignTypes {
    WHOLE_KWIC = 'whole'
}

export const enum PqueryExpressionRoles {
    SPECIFICATION = 'specification',
    SUBSET = 'subset',
    SUPERSET = 'superset',
}

export type ExpressionRoleType = {type:PqueryExpressionRoles, maxNonMatchingRatio:number};

export interface ParadigmaticQuery extends AdvancedQuery {
    expressionRole:ExpressionRoleType;
}

export interface PqueryFormModelState {
    isBusy:boolean;
    modalVisible:boolean;
    corpname:string;
    usesubcorp:string;
    queries:{[sourceId:string]:ParadigmaticQuery}; // pquery block -> query
    downArrowTriggersHistory:{[sourceId:string]:boolean};
    cqlEditorMessages:{[sourceId:string]:string};
    useRichQueryEditor:boolean;
    concWait:{[sourceId:string]:ConcStatus};
    task:Kontext.AsyncTaskInfo<AsyncTaskArgs>|undefined;
    minFreq:number;
    posLeft:number;
    posRight:number;
    posAlign:AlignTypes|PqueryAlignTypes;
    attr:string;
    attrs:Array<Kontext.AttrItem>;
    structAttrs:Array<Kontext.AttrItem>;
    paramsVisible:boolean;
}

/**
 *
 */
export function createSourceId(i:number):string {
    return `pqitem_${i}`;
}

/**
 * Returns a state with empty queries and default param selections
 */
export function newModelState(
    corpname:string,
    usesubcorp:string,
    attrs:Array<Kontext.AttrItem>,
    structAttrs:Array<Kontext.AttrItem>,
    useRichQueryEditor:boolean,
    defaultAttr:string
):PqueryFormModelState {

    return {
        isBusy: false,
        modalVisible: false,
        corpname,
        usesubcorp,
        queries: pipe(
            List.repeat<[string, ParadigmaticQuery]>(
                idx => tuple(
                    createSourceId(idx),
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
                        expressionRole: {type: PqueryExpressionRoles.SPECIFICATION, maxNonMatchingRatio: 100}
                    }
                ),
                2
            ),
            Dict.fromEntries()
        ),
        downArrowTriggersHistory: pipe(
            List.repeat(idx => tuple(createSourceId(idx), false), 2),
            Dict.fromEntries()
        ),
        cqlEditorMessages: pipe(
            List.repeat(idx => tuple(createSourceId(idx), ''), 2),
            Dict.fromEntries()
        ),
        useRichQueryEditor,
        concWait: pipe(
            List.repeat<[string, ConcStatus]>(idx => tuple(createSourceId(idx), 'none'), 2),
            Dict.fromEntries()
        ),
        task: undefined,
        minFreq: 5,
        posLeft: 0,
        posRight: 0,
        posAlign: AlignTypes.LEFT,
        attr: defaultAttr,
        attrs,
        structAttrs,
        paramsVisible: true,
    };
}

export function storedQueryToModel(
    sq:FreqIntersectionArgs,
    concQueries:ConcQueries,
    attrs:Array<Kontext.AttrItem>,
    structAttrs:Array<Kontext.AttrItem>,
    useRichQueryEditor:boolean
):PqueryFormModelState {

    return {
        isBusy: false,
        modalVisible: false,
        corpname: sq.corpname,
        usesubcorp: sq.usesubcorp,
        queries: pipe(
            concQueries,
            List.map<AdvancedQuerySubmit, [string, ParadigmaticQuery]>(
                (query, i) => {
                    const [queryHtml, parsedAttrs] = highlightSyntaxStatic(
                        query.query,
                        'advanced',
                        {
                            translate: (s:string, values?:any) => s
                        }
                    );

                    return tuple(
                        createSourceId(i),
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
                            default_attr: query.default_attr,
                            expressionRole: {type: PqueryExpressionRoles.SPECIFICATION, maxNonMatchingRatio: 100}
                        }
                    )
                }
            ),
            Dict.fromEntries()
        ),
        downArrowTriggersHistory: pipe(
            concQueries,
            List.map((q, i) => tuple(createSourceId(i), false)),
            Dict.fromEntries()
        ),
        cqlEditorMessages: pipe(
            concQueries,
            List.map((q, i) => tuple(createSourceId(i), '')),
            Dict.fromEntries()
        ),
        useRichQueryEditor,
        concWait: pipe(
            concQueries,
            List.map<AdvancedQuerySubmit, [string, ConcStatus]>(
                (v, i) => tuple(createSourceId(i), 'none')
            ),
            Dict.fromEntries()
        ),
        task: undefined,
        minFreq: sq.min_freq,
        posLeft: sq.pos_left,
        posRight: sq.pos_right,
        posAlign: sq.pos_align,
        attr: sq.attr,
        attrs,
        structAttrs,
        paramsVisible: true,
    }
}

export function importConcQueries(
    queryIds:Array<string>,
    args:InvolvedConcFormArgs

):Array<StoredAdvancedQuery> {
    return pipe(
        queryIds,
        List.map(qId => tuple(qId, args[qId])), // order is important (so no Dict.keys() here)
        List.flatMap(
            ([conc_id, formArgs]) => pipe(
                formArgs.curr_queries,
                Dict.toEntries(),
                List.map(
                    ([corpname, query]) => ({
                        corpname,
                        qtype: 'advanced',
                        query,
                        pcq_pos_neg: 'pos',
                        include_empty: false,
                        default_attr:  formArgs.curr_default_attr_values[corpname],
                        conc_id
                    })
                )
            )
        )
    );
}