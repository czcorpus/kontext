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

export interface SimpleQuery {
    corpname:string;
    qtype:'simple';
    queryParsed:Array<[string, string]>;
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
        queryParsed: List.map(
            item => tuple(q.default_attr, item),
            q.query.split(' ')
        ),
        qmcase: false,
        pcq_pos_neg: 'pos',
        include_empty: false,
        default_attr: q.default_attr,
        use_regexp: true
    };
}

export function parseSimpleQuery(q:string|null, attr:string):Array<[string, string]> {
    if (!q) {
        return [tuple(attr, '')];
    }
    return List.map(
        item => tuple(attr, item),
        q.split(/\s+/)
    );
}