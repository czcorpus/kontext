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

import { id, List, pipe, tuple } from 'cnc-tskit';
import { highlightSyntaxStatic, ParsedAttr } from './cqleditor/parser';


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
    focusedAttr:ParsedAttr|undefined;
    rawAnchorIdx:number;
    rawFocusIdx:number;
    queryHtml:string;
    pcq_pos_neg:string;
    include_empty:boolean;
    default_attr:string;
}


export interface ParsedSimpleQueryToken {

    value:string;

    trailingSpace:string;

    /**
     * the value represents logical conjunction of
     * attr1 == val1 & attr2 == val2 & ... & attrN == valN
     */
    args:Array<[string|undefined, string]>;

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
    pcq_pos_neg:string;
    include_empty:boolean;
    default_attr:string;
    use_regexp:boolean;
}

export type AnyQuery = SimpleQuery|AdvancedQuery;

/**
 * SimpleQuerySubmit is a form of SimpleQuery as submitted to server
 */
export interface SimpleQuerySubmit {
    corpname:string;
    qtype:'simple';
    query:string;
    queryParsed:Array<Array<[string|Array<string>, string]>>;
    qmcase:boolean;
    pcq_pos_neg:string;
    include_empty:boolean;
    default_attr:string;
    use_regexp:boolean;
}

/**
 * AdvancedQuerySubmit is a form of AdvancedQuery as submitted to server
 */
export interface AdvancedQuerySubmit {
    corpname:string;
    qtype:'advanced';
    query:string;
    pcq_pos_neg:string;
    include_empty:boolean;
    default_attr:string;
}

export type AnyQuerySubmit = SimpleQuerySubmit|AdvancedQuerySubmit;


export function findTokenIdxByFocusIdx(q:AnyQuery, focusIdx:number):number {
    if (q.qtype === 'simple') {
        for (let i = 0; i < q.queryParsed.length; i++) {
            if (q.queryParsed[i].position[0] <= focusIdx && focusIdx <= q.queryParsed[i].position[1]) {
                return i;
            }
        }

    } else {
        for (let i = 0; i < q.parsedAttrs.length; i++) {
            if (q.parsedAttrs[i].rangeAll[0] <= focusIdx && focusIdx <= q.parsedAttrs[i].rangeAll[1]) {
                return i;
            }
        }
    }
    return -1;
}

export function simpleToAdvancedQuery(q:SimpleQuery):AdvancedQuery {
    const [queryHtml, parsedAttrs] = highlightSyntaxStatic(q.query, 'advanced', {translate: id});
    return {
        corpname: q.corpname,
        qtype: 'advanced',
        query: q.query,
        parsedAttrs,
        focusedAttr: undefined,
        rawAnchorIdx: q.rawAnchorIdx,
        rawFocusIdx: q.rawFocusIdx,
        queryHtml,
        pcq_pos_neg: q.pcq_pos_neg,
        include_empty: q.include_empty,
        default_attr: q.default_attr
    };
}

export function advancedToSimpleQuery(q:AdvancedQuery):SimpleQuery {
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
        default_attr: q.default_attr,
        use_regexp: true
    };
}

export function runSimpleQueryParser(q:string, onToken:(t:ParsedSimpleQueryToken, idx:number, charIdx:number)=>void, onSpace:()=>void):void {
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
export function parseSimpleQuery(q:string|null, attr:string):Array<ParsedSimpleQueryToken>;
export function parseSimpleQuery(q:SimpleQuery|string|null, attr?:string):Array<ParsedSimpleQueryToken> {
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
