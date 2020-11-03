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

import { List, tuple } from 'cnc-tskit';


export type QueryType = 'simple'|'advanced';


export interface AdvancedQuery {
    corpname:string;
    qtype:'advanced';
    query:string;
    pcq_pos_neg:string;
    include_empty:boolean;
    default_attr:string;
}

export interface ParsedSimpleQueryToken {

    /**
     * the value represents logical conjunction of
     * attr1 == val1 & attr2 == val2 & ... & attrN == valN
     */
    args:Array<[string, string]>;

    /**
     * Position of a respective token. In case of an empty
     * input, [-1, -1] should be used.
     */
    position:[number, number];
}

export interface SimpleQuery {
    corpname:string;
    qtype:'simple';
    queryParsed:Array<ParsedSimpleQueryToken>;
    query:string;
    qmcase:boolean;
    pcq_pos_neg:string;
    include_empty:boolean;
    default_attr:string;
    use_regexp:boolean;
}

export type AnyQuery = SimpleQuery|AdvancedQuery;

export function simpleToAdvancedQuery(q:SimpleQuery):AdvancedQuery {
    return {
        corpname: q.corpname,
        qtype: 'advanced',
        query: q.query,
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
        qmcase: false,
        pcq_pos_neg: 'pos',
        include_empty: false,
        default_attr: q.default_attr,
        use_regexp: true
    };
}

export function parseSimpleQuery(q:SimpleQuery):Array<ParsedSimpleQueryToken>;
export function parseSimpleQuery(q:string|null, attr:string):Array<ParsedSimpleQueryToken>;
export function parseSimpleQuery(q:SimpleQuery|string|null, attr?:string):Array<ParsedSimpleQueryToken> {
    if (q === null) {
        return [{args: [tuple(attr, '')], position: [-1, -1]}];
    }
    const qVal = typeof q === 'string' ? q.trim() : q.query.trim();
    const attrVal = typeof q === 'string' ? attr : q.default_attr;
    const ans:Array<ParsedSimpleQueryToken> = [];
    let currWord = [];
    let startWord = 0;
    let i = 0;
    for (; i < qVal.length; i++) {
        if (qVal[i] !== ' ') {
            currWord.push(qVal[i]);
        }
        if (qVal[i] === ' ' || i === qVal.length - 1) {
            if (!List.empty(currWord)) {
                ans.push({
                    args: [tuple(attrVal, currWord.join(''))],
                    position: [startWord, qVal[i] === ' ' ? i-1 : i]
                });
            }
            currWord = [];
            startWord = i+1;
        }
    }
    return ans;
}
