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
import * as Kontext from '../../types/kontext';
import { highlightSyntaxStatic, ParsedPQItem } from '../cqleditor/parser';
import { AlignTypes } from '../freqs/twoDimension/common';
import { AdvancedQuery, AdvancedQuerySubmit } from '../query/query';
import { FilterFormArgs, isQueryFormArgs, QueryFormArgs } from '../query/formArgs';

const MAX_NUM_PARTIAL_QUERIES = 15;

/**
 * PqueryResult is a result of a Paradigmatic query
 * The first item is the word, other items are individual absolute
 * frequencies of all the involved concordances.
 */
export type PqueryResult = Array<[string, ...number[]]>;


export interface ExpressionRoleType {
    type:Kontext.PqueryExpressionRoles;
    maxNonMatchingRatio:Kontext.FormValue<string>;

};


export interface SubsetComplementsAndRatio {
    max_non_matching_ratio:number;
    conc_ids:Array<string>;
}


export interface SupersetAndRatio {
    max_non_matching_ratio:number;
    conc_id:string;
}


export interface FreqIntersectionArgs {
    corpname:string;
    usesubcorp:string;
    conc_ids:Array<string>;
    pquery_type:Kontext.PqueryType;
    conc_subset_complements:SubsetComplementsAndRatio|null;
    conc_superset:SupersetAndRatio|null;
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

export type ConcQueries = {[concId:string]:StoredAdvancedQuery};

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

export type ConcStatus = 'none' | 'running' | 'finished' | 'failed';

export interface HistoryArgs {
    corpname:string;
    usesubcorp:string;
    queryId:string;
    sort:string;
    page:number;
}

export type InvolvedConcFormArgs = {[queryId:string]:QueryFormArgs|FilterFormArgs};

export const enum PqueryAlignTypes {
    WHOLE_KWIC = 'whole'
}

/**
 * ParadigmaticTypeQuery represents a pure CQL-written
 * individual type definition (including "always" and "never")
 */
export interface ParadigmaticPartialQuery extends AdvancedQuery {
    expressionRole:ExpressionRoleType;
    type:'partial-query';
}

export interface ParadigmaticQuery extends AdvancedQuery {
    pqItems:Array<ParsedPQItem>;
    type:'full-query';
}

type ParadigmaticQueriesStorage = {[sourceId:string]:ParadigmaticPartialQuery|ParadigmaticQuery};

export interface PqueryFormModelState {
    isBusy:boolean;
    modalVisible:boolean;
    corpname:string;
    usesubcorp:string;
    pqueryType:Kontext.PqueryType;
    maxNumQueries:number;
    queries:ParadigmaticQueriesStorage; // pquery block -> query
    downArrowTriggersHistory:{[sourceId:string]:boolean};
    cqlEditorMessages:{[sourceId:string]:Array<string>};
    useRichQueryEditor:boolean;
    concWait:{[sourceId:string]:ConcStatus};
    calcProgress:number|undefined; // 0-100%, just a rough estimate
    task:Kontext.AsyncTaskInfo<AsyncTaskArgs>|undefined;
    minFreq:Kontext.FormValue<string>;
    posLeft:number;
    posRight:number;
    posAlign:AlignTypes|PqueryAlignTypes;
    attr:string;
    attrs:Array<Kontext.AttrItem>;
    structAttrs:Array<Kontext.AttrItem>;
    paramsVisible:boolean;
    posRangeNotSupported:boolean;  // for structural attributes pos range makes no sense
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
        pqueryType: 'split',
        maxNumQueries: MAX_NUM_PARTIAL_QUERIES,
        queries: pipe(
            List.repeat<[string, ParadigmaticPartialQuery]>(
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
                        expressionRole: {
                            type: 'specification',
                            maxNonMatchingRatio: Kontext.newFormValue('0', true)
                        },
                        type: 'partial-query'
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
            List.repeat(idx => tuple(createSourceId(idx), []), 2),
            Dict.fromEntries()
        ),
        useRichQueryEditor,
        concWait: pipe(
            List.repeat<[string, ConcStatus]>(idx => tuple(createSourceId(idx), 'none'), 2),
            Dict.fromEntries()
        ),
        calcProgress: undefined,
        task: undefined,
        minFreq: Kontext.newFormValue('5', true),
        posLeft: 0,
        posRight: 0,
        posAlign: AlignTypes.LEFT,
        attr: defaultAttr,
        attrs,
        structAttrs,
        paramsVisible: true,
        posRangeNotSupported: defaultAttr.includes('.')
    };
}

export function splitFullQuery(
    queries:ParadigmaticQueriesStorage,
    corpname:string
):{[sourceId:string]:ParadigmaticPartialQuery} {

    const fullQuery = queries['full'];
    if (fullQuery.type === 'full-query') {
        return pipe(
            fullQuery.pqItems,
            List.concat(
                List.repeat(
                    _ => ({
                        query: '',
                        limit: 0,
                        type: 'specification'
                    } as ParsedPQItem),
                    Math.max(0, 2 - List.size(fullQuery.pqItems))
                )
            ),
            List.map<ParsedPQItem, [string, ParadigmaticPartialQuery]>(
                (item, idx) => tuple(
                    createSourceId(idx),
                    {
                        corpname,
                        qtype: 'advanced',
                        query: item.query,
                        parsedAttrs: [],
                        focusedAttr: undefined,
                        rawAnchorIdx: 0,
                        rawFocusIdx: 0,
                        queryHtml: '',
                        pcq_pos_neg: 'pos',
                        include_empty: true,
                        default_attr: null,
                        expressionRole: {
                            type: item.type,
                            maxNonMatchingRatio: Kontext.newFormValue(item.limit + '', true)
                        },
                        type: 'partial-query'
                    }
                )
            ),
            Dict.fromEntries()
        );

    } else {
        throw new Error('No full query defined');
    }
}

export function joinPartialQueries(
    queries:ParadigmaticQueriesStorage,
    corpname:string
):ParadigmaticQuery {

    const items:Array<string> = pipe(
        queries,
        Dict.toEntries(),
        List.filter(([,v]) => v.query !== ''),
        List.sortedAlphaBy(([k,]) => k),
        List.map(([,query]) => {
            if (query.type === 'partial-query') {
                switch (query.expressionRole.type) {
                    case 'specification':
                        return ['{ ', query.query, ' }'];
                    case 'subset':
                        return [
                            '!',
                            parseFloat(query.expressionRole.maxNonMatchingRatio.value || '0') > 0 ?
                                query.expressionRole.maxNonMatchingRatio.value :
                                '',
                            '{ ',
                            query.query,
                            ' }'
                        ];
                    case 'superset':
                        return [
                            '?',
                            parseFloat(query.expressionRole.maxNonMatchingRatio.value || '0') > 0 ?
                                query.expressionRole.maxNonMatchingRatio.value :
                                '',
                            '{ ',
                            query.query,
                            ' }'
                        ];
                    default:
                        return [];
                }
            }
            return [];
        }),
        List.join(_ => [' &&\n']),
        List.flatMap(v => v)
    );
    return {
        corpname,
        qtype: 'advanced',
        query: items.join(''),
        parsedAttrs: [],
        pqItems: [],
        focusedAttr: undefined,
        rawAnchorIdx: 0,
        rawFocusIdx: 0,
        queryHtml: '',
        pcq_pos_neg: 'pos',
        include_empty: true,
        default_attr: null,
        type: 'full-query'
    };
}

function importQueries(pqueryForm:FreqIntersectionArgs, concQueries:ConcQueries) {

    function findQuery(concId:string):[Kontext.PqueryExpressionRoles, number]  {
        const srch1 = List.find(v => v === concId, pqueryForm.conc_ids);
        if (srch1) {
            return tuple('specification', 0);
        }
        const srch2 = pqueryForm.conc_subset_complements ?
            List.find(v => v === concId, pqueryForm.conc_subset_complements.conc_ids) : undefined;
        if (srch2) {
            return tuple('subset', pqueryForm.conc_subset_complements.max_non_matching_ratio);
        }
        if (pqueryForm.conc_superset && pqueryForm.conc_superset.conc_id === concId) {
            return tuple('superset', pqueryForm.conc_superset.max_non_matching_ratio);
        }
        throw new Error('Unknown query role');
    }

    const allConcIds = [...pqueryForm.conc_ids];
    if (pqueryForm.conc_subset_complements) {
        // we need just the first query item as all the filters contain the same CQL
        allConcIds.push(pqueryForm.conc_subset_complements.conc_ids[0]);
    }
    if (pqueryForm.conc_superset) {
        allConcIds.push(pqueryForm.conc_superset.conc_id);
    }

    const splitQueries = pipe(
        allConcIds,
        List.map(concId => concQueries[concId]),
        List.map<StoredAdvancedQuery, [string, ParadigmaticPartialQuery]>(
            (query, i) => {
                const [qRole, maxNonMatchingRatio] = findQuery(query.conc_id);
                return tuple(
                    createSourceId(i),
                    {
                        corpname: query.corpname,
                        qtype: 'advanced',
                        query: query.query,
                        parsedAttrs: [],
                        focusedAttr: null,
                        rawAnchorIdx: 0,
                        rawFocusIdx: 0,
                        queryHtml: '',
                        pcq_pos_neg: 'pos',
                        include_empty: query.include_empty,
                        default_attr: query.default_attr,
                        expressionRole: {
                            type: qRole,
                            maxNonMatchingRatio: Kontext.newFormValue('' + maxNonMatchingRatio, true)
                        },
                        type: 'partial-query'
                    }
                )
            }
        )
    );

    const actualQueries:Array<[string, ParadigmaticPartialQuery|ParadigmaticQuery]> =
        pqueryForm.pquery_type === 'split' ?
            splitQueries :
            [tuple('full', joinPartialQueries(Dict.fromEntries(splitQueries), pqueryForm.corpname))];

    List.forEach(
        ([,query]) => {
            const [queryHtml, parsedAttrs, pqItems] = highlightSyntaxStatic({
                query: query.query,
                querySuperType: pqueryForm.pquery_type === 'full' ? 'pquery' : 'conc',
                he: {
                    translate: (s:string, values?:any) => s
                }
            });
            query.queryHtml = queryHtml;
            query.parsedAttrs = parsedAttrs;
            if (query.type === 'full-query') {
                query.pqItems = pqItems;
            }
        },
        actualQueries
    );

    return actualQueries;
}

export function storedQueryToModel(
    sq:FreqIntersectionArgs,
    concQueries:ConcQueries,
    attrs:Array<Kontext.AttrItem>,
    structAttrs:Array<Kontext.AttrItem>,
    useRichQueryEditor:boolean
):PqueryFormModelState {
    const queries = importQueries(sq, concQueries);
    return {
        isBusy: false,
        modalVisible: false,
        corpname: sq.corpname,
        usesubcorp: sq.usesubcorp,
        pqueryType: sq.pquery_type,
        maxNumQueries: MAX_NUM_PARTIAL_QUERIES,
        queries: Dict.fromEntries(queries),
        downArrowTriggersHistory: pipe(
            queries,
            List.map((q, i) => tuple(createSourceId(i), false)),
            Dict.fromEntries()
        ),
        cqlEditorMessages: pipe(
            queries,
            List.map((q, i) => tuple(createSourceId(i), [])),
            Dict.fromEntries()
        ),
        useRichQueryEditor,
        concWait: pipe(
            queries,
            List.map<[string, ParadigmaticPartialQuery|ParadigmaticQuery], [string, ConcStatus]>(
                (v, i) => tuple(createSourceId(i), 'none')
            ),
            Dict.fromEntries()
        ),
        calcProgress: undefined,
        task: undefined,
        minFreq: Kontext.newFormValue('' + sq.min_freq, true),
        posLeft: sq.pos_left,
        posRight: sq.pos_right,
        posAlign: sq.pos_align,
        attr: sq.attr,
        attrs,
        structAttrs,
        paramsVisible: true,
        posRangeNotSupported: sq.attr.includes('.')
    }
}

export function importConcQueries(
    args:InvolvedConcFormArgs
):ConcQueries {

    function extractQuery(
        q:QueryFormArgs|FilterFormArgs
    ):[{[k:string]:string}, {[k:string]:string}] {

        if (isQueryFormArgs(q)) {
            return tuple(q.curr_queries, q.curr_default_attr_values);
        }
        return tuple({[q.maincorp]: q.query}, {[q.maincorp]: q.default_attr});
    }

    return pipe(
        args,
        Dict.toEntries(),
        List.flatMap(
            ([conc_id, formArgs]) => {
                const [queries, defaultAttrs] = extractQuery(formArgs);
                return pipe(
                    queries,
                    Dict.toEntries(),
                    List.map(
                        ([corpname, query]) => tuple(
                            conc_id,
                            ({
                                corpname,
                                qtype: 'advanced' as 'advanced',
                                query,
                                pcq_pos_neg: 'pos' as 'pos'|'neg',
                                include_empty: false,
                                default_attr:  defaultAttrs[corpname],
                                conc_id
                            })
                        )
                    )
                );
            }
        ),
        Dict.fromEntries()
    );
}