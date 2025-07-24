/*
 * Copyright (c) 2016 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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

import * as Kontext from '../../../types/kontext.js';
import { ConcFormArgs } from '../formArgs.js';


/**
 * for attribute description, see Kontext.QueryOperation
 */
export interface PersistentQueryOperation {

    formType:string;

    /**
     * note: if undefined then the operation is not synced yet
     */
    concPersistenceId:string|undefined;

    isRegisteredAuthor:boolean;

    op:string;

    opid:Kontext.ManateeOpCode;

    userEntry:string;

    encodedArgs:string;

    size:number;

    fullSize:number;
}


export interface QueryPipelineResponseItem {
    form_args:ConcFormArgs;
    id:string;
}

export interface QueryPipelineResponse extends Kontext.AjaxResponse {
    ops:Array<QueryPipelineResponseItem>;
    query_overview:Array<Kontext.QueryOperation>;
}

export interface NormalizeConcFormArgsResp {
    author_id:number;
}

/**
 *
 */
export function mapOpIdToFormType(opId:Kontext.ManateeOpCode):string {

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

export function exportDecodedOperation(operation:PersistentQueryOperation):Kontext.QueryOperation {
    return {
        op: operation.op,
        opid: operation.opid,
        nicearg: null,
        args: operation.encodedArgs,
        size: operation.size,
        fullsize: operation.fullSize,
        conc_persistence_op_id: operation.concPersistenceId,
        is_registered_author: operation.isRegisteredAuthor
    };
}

export function importEncodedOperation(operation:Kontext.QueryOperation):PersistentQueryOperation {

    return {
        op: operation.op,
        opid: operation.opid,
        userEntry: operation.nicearg,
        encodedArgs: operation.args,
        concPersistenceId: operation.conc_persistence_op_id,
        isRegisteredAuthor: operation.is_registered_author,
        size: operation.size,
        fullSize: operation.fullsize,
        formType: mapOpIdToFormType(operation.opid)
    };
}
