/*
 * Copyright (c) 2016 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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

import { id, List, tuple } from 'cnc-tskit';
import { highlightSyntaxStatic, ParsedAttr } from '../cqleditor/parser.js';
import { SubmitEncodedSimpleTokens } from './formArgs.js';


export type QueryType = 'simple'|'advanced';


export interface QuerySuggestion<T> {
    rendererId:string;
    providerId:string;
    contents:T;
    heading:string;
    isShortened:boolean;
    isActive:boolean;
}


export interface TokenSuggestions {
    data:Array<QuerySuggestion<unknown>>;
    isPartial:boolean;
    valuePosStart:number;
    valuePosEnd:number;
    attrPosStart?:number;
    attrPosEnd?:number;
    timeReq:number;
}


export interface AdvancedQuery {
    corpname:string;
    qtype:'advanced';
    query:string;
    parsedAttrs:Array<ParsedAttr>;
    suggestions:TokenSuggestions|null;
    focusedAttr:ParsedAttr|undefined;
    rawAnchorIdx:number;
    rawFocusIdx:number;
    queryHtml:string;
    containsWithin:boolean;
    pcq_pos_neg:'pos'|'neg';
    include_empty:boolean;
    default_attr:string;
}


export interface ParsedSimpleQueryToken {

    value:string;

    trailingSpace:string;

    /**
     * the value represents logical conjunction of
     * attr1 == val1 & attr2 == val2 & ... & attrN == valN
     *
     * in case the first element of an item is an array, the interpretation
     * is as follows: (attr1A == val1 | attr1B == va1 | ...) (this is just a single
     * item of the top level array.
     *
     * in case the first element of an item is undefined we rely on what form model
     * injects as default attribute (please note that this cannot be applied in case
     * we return to an existing query as after a time the default attribute(s) can be
     * different and thus the query wouldn't be replicable)
     */
    args:Array<[string|Array<string>|undefined, string]>;

    /**
     * Position of a respective token. In case of an empty
     * input, [-1, -1] should be used.
     */
    position:[number, number];

    suggestions:TokenSuggestions|null; // TODO use undefined instead of null

    isExtended:boolean;
}


export interface SimpleQuery {
    corpname:string;
    qtype:'simple';
    queryParsed:Array<ParsedSimpleQueryToken>;
    query:string;
    queryHtml:string;
    rawAnchorIdx:number;
    rawFocusIdx:number;
    qmcase:boolean;
    pcq_pos_neg:'pos'|'neg';
    include_empty:boolean;
    default_attr:string|Array<string>;
    use_regexp:boolean;
}

export type AnyQuery = SimpleQuery|AdvancedQuery;

export function isAdvancedQuery(anyQuery:AnyQuery): anyQuery is AdvancedQuery {
    return anyQuery.qtype === 'advanced';
}

export function isSimpleQuery(anyQuery:AnyQuery): anyQuery is SimpleQuery {
    return anyQuery.qtype === 'simple';
}

/**
 * SimpleQuerySubmit is a form of SimpleQuery as submitted to server
 */
export interface SimpleQuerySubmit {
    corpname:string;
    qtype:'simple';
    query:string;
    queryParsed:SubmitEncodedSimpleTokens;
    qmcase:boolean;
    pcq_pos_neg:'pos'|'neg';
    include_empty:boolean;
    default_attr:string|Array<string>;
    use_regexp:boolean;
}

/**
 * AdvancedQuerySubmit is a form of AdvancedQuery as submitted to server
 */
export interface AdvancedQuerySubmit {
    corpname:string;
    qtype:'advanced';
    query:string;
    pcq_pos_neg:'pos'|'neg';
    include_empty:boolean;
    contains_within:boolean;
    default_attr:string;
}

export type AnyQuerySubmit = SimpleQuerySubmit|AdvancedQuerySubmit;


export function findTokenIdxBySuggFocusIdx(q:AnyQuery, focusIdx:number):number {
    if (q.qtype === 'simple') {
        for (let i = 0; i < q.queryParsed.length; i++) {
            if (q.queryParsed[i].position[0] <= focusIdx && focusIdx <= q.queryParsed[i].position[1]) {
                return i;
            }
        }
    }
    return 0;
}

/**
 * Transform simple query to an advanced one. Please note that default attribute
 * is not preserved as it serves a bit different purposes in both query types.
 */
export function simpleToAdvancedQuery(q:SimpleQuery, defaultAttr:string):AdvancedQuery {
    const query = q.query.trim();
    const parsed = highlightSyntaxStatic({
        query,
        querySuperType: 'conc',
        he: {translate: id}
    });
    return {
        corpname: q.corpname,
        qtype: 'advanced',
        query,
        parsedAttrs: parsed.parsedAttrs,
        suggestions: null,
        focusedAttr: undefined,
        rawAnchorIdx: query.length,
        rawFocusIdx: query.length,
        queryHtml: parsed.highlighted,
        containsWithin: List.some(
            x => x.containsWithin,
            parsed.ast.withinOrContainingList || [],
        ),
        pcq_pos_neg: q.pcq_pos_neg,
        include_empty: q.include_empty,
        default_attr: defaultAttr
    };
}

/**
 * Transform advanced query to a simple one. Please note that default attribute
 * is not preserved as it serves a bit different purposes in both query types.
 */
export function advancedToSimpleQuery(q:AdvancedQuery, defaultAttr:string|Array<string>):SimpleQuery {
    return {
        corpname: q.corpname,
        qtype: 'simple',
        query: q.query,
        queryParsed: parseSimpleQuery(q.query, q.default_attr),
        queryHtml: q.queryHtml,
        rawAnchorIdx: q.rawAnchorIdx,
        rawFocusIdx: q.rawFocusIdx,
        qmcase: false,
        pcq_pos_neg: 'pos',
        include_empty: false,
        default_attr: defaultAttr,
        use_regexp: false
    };
}

/**
 * Test whether parsed query data in both provided queries are strictly equal.
 * This is mostly used in change detection in React components. In case the
 * types of q1 and q2 are different (SimpleQuery vs AdvancedQuery) false is
 * always returned.
 */
export function strictEqualParsedQueries(q1:AnyQuery, q2:AnyQuery):boolean {
    if (q1.qtype === 'simple' && q2.qtype === 'simple') {
        return q1.queryParsed === q2.queryParsed;

    } else if (q1.qtype === 'advanced' && q2.qtype === 'advanced') {
        return q1.parsedAttrs === q2.parsedAttrs;
    }
    return false;
}

export function runSimpleQueryParser(
    q:string,
    onToken:(t:ParsedSimpleQueryToken, idx:number, charIdx:number)=>void,
    onSpace:()=>void
):void {

    let currWord = [];
    let startWord = 0;
    const isWhitespace = (s:string) => /^\s$/.exec(s) !== null;
    let tokenIdx = 0;
    for (let i = 0; i < q.length; i++) {
        if (!isWhitespace(q[i])) {
            currWord.push(q[i]);
        }
        if (isWhitespace(q[i]) || i === q.length - 1) {
            if (!List.empty(currWord)) {
                onToken(
                    {
                        args: [],
                        position: [startWord, isWhitespace(q[i]) ? i-1 : i],
                        value: currWord.join(''),
                        suggestions: null,
                        isExtended: false,
                        trailingSpace: ''
                    },
                    tokenIdx,
                    i
                );
                tokenIdx++;
            }
            currWord = [];
            startWord = i+1;
        }
        if (isWhitespace(q[i])) {
            onSpace();
        }
    }
}

export function parseSimpleQuery(q:SimpleQuery):Array<ParsedSimpleQueryToken>;
export function parseSimpleQuery(q:string|null, attr:string|Array<string>):Array<ParsedSimpleQueryToken>;
export function parseSimpleQuery(q:SimpleQuery|string|null, attr?:string|Array<string>):Array<ParsedSimpleQueryToken> {
    if (q === null) {
        return [{
            args: [tuple(attr, '')],
            position: [-1, -1],
            value: '',
            suggestions: null,
            isExtended: false,
            trailingSpace: ''
        }];
    }
    const qVal = typeof q === 'string' ? q : q.query;
    const attrVal = typeof q === 'string' ? attr : q.default_attr;
    const ans:Array<ParsedSimpleQueryToken> = [];
    runSimpleQueryParser(
        qVal,
        (token) => {
            ans.push({
                ...token,
                args: [tuple(attrVal, token.value)]
            });
        },
        () => {
            if (!List.empty(ans)) {
                List.last(ans).trailingSpace += ' ';
            }
        }
    );
    return ans;
}
