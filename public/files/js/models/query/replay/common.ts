/*
 * Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
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

import { Kontext } from '../../../types/common';
import { AjaxResponse } from '../../../types/ajaxResponses';


export interface QueryOverviewResponseRow {
    op:string;
    opid:string;
    tourl:string;
    nicearg:string;
    size:number;
}

/**
 *
 */
export interface ExtendedQueryOperation extends Kontext.QueryOperation {
    formType:string;
}


export interface QueryPipelineResponseItem {
    form_args:AjaxResponse.ConcFormArgs;
    id: string;
}

export interface QueryPipelineResponse extends Kontext.AjaxResponse {
    ops:Array<QueryPipelineResponseItem>;
    query_overview:Array<Kontext.QueryOperation>;
}

/**
 *
 */
function mapOpIdToFormType(opId:string):string {
    /*
        query operation codes:
        q: Query
        a: Query
        r: Random sample
        s: Sort
        f: Shuffle
        D: Remove nested matches
        F: First hits in documents
        n: Negative filter
        N: Negative filter (excluding KWIC)
        p: Positive filter
        P: Positive filter (excluding KWIC)
        x: Switch KWIC
    */
    if (['q', 'a'].indexOf(opId) > -1) {
        return Kontext.ConcFormTypes.QUERY;

    } else if (['n', 'N', 'p', 'P'].indexOf(opId) > -1) {
        return Kontext.ConcFormTypes.FILTER;

    } else if (opId === 's') {
        return Kontext.ConcFormTypes.SORT;

    } else if (opId === 'r') {
        return Kontext.ConcFormTypes.SAMPLE;

    } else if (opId === 'f') {
        return Kontext.ConcFormTypes.SHUFFLE;

    } else if (opId === 'x') {
        return Kontext.ConcFormTypes.SWITCHMC;

    } else if (opId === 'D') {
        return Kontext.ConcFormTypes.SUBHITS;

    } else if (opId === 'F') {
        return Kontext.ConcFormTypes.FIRSTHITS;
    }
}

export function importEncodedOperation(operation:Kontext.QueryOperation):ExtendedQueryOperation {
    return {
        op: operation.op,
        opid: operation.opid,
        nicearg: operation.nicearg,
        tourl: operation.tourl,
        arg: operation.arg,
        size: operation.size,
        formType: mapOpIdToFormType(operation.opid)
    };
}
