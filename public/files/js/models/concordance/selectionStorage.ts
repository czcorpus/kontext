/*
 * Copyright (c) 2014 Institute of the Czech National Corpus
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

import { LineSelections, LineSelectionModes } from './common';


const accessKey = 'concLines';
const queryKey = '__query__';

const queryKeyFilter = List.filter<[string, [number, number]]>(([k,]) => k !== queryKey);

export interface StorageUsingState {
    data:LineSelections;
}

/**
 * This object is used for accessing stored concordance lines and is based on
 * browser's sessionStorage. Individual changes (via addLine(), removeLine())
 * are not stored immediately. It is up to programmer to use method serialize()
 * (e.g. using window's unload event) to make changes session-permanent.
 */
export class ConcLinesStorage {


    private state:StorageUsingState; // we expect mutable state here (see LineSelectionModel)

    private queryId:number;

    errorHandler:any; // TODO type

    static DEFAULT_GROUP_ID = 1;

    constructor(errorHandler) {
        this.errorHandler = errorHandler;
        this.state = {data: {}};
    }

    init(state:StorageUsingState, query:Array<string>):void {
        this.queryId = this.queryChecksum(query.join(''));
        if (this.state.data[queryKey] && this.state.data[queryKey][0] !== this.queryId) {
            this.clear();
        }
        this.state.data[queryKey] = tuple(this.queryId, -1);
        this.serialize();
    }

    /**
     *
     * @returns true if browser supports sessionStorage else false
     */
    supportsSessionStorage():boolean {
        try {
            return 'sessionStorage' in window && window['sessionStorage'] !== null;

        } catch (e) {
            return false;
        }
    }

    /**
     * Adds a selected concordance line.
     *
     * @param id position number of first kwic word
     * @param kwiclen number of kwic words
     * @param category category number
     */
    addLine(id:string, kwiclen:number, category:number):void {
        this.state.data[id] = tuple(kwiclen, category);
    }

    removeLine(id):void {
        delete this.state.data[id];
    }

    containsLine(id:string):boolean {
        return this.state.data[id] !== undefined;
    }

    getLine(id:string):any { // TODO return type
        return this.state.data[id] || null;
    }

    /**
     * Returns all the selected lines. Each line
     * is encoded like this: [kwic_token_id, kwic_len, line_number, category].
     */
    exportAll():Array<[number, number, number]> {
        return pipe(
            this.state.data,
            Dict.toEntries(),
            queryKeyFilter,
            List.map(([p, [line, grp]]) => tuple(parseInt(p), line, grp))
        )
    }

    /**
     * Removes all the elements and writes the change into sessionStorage
     */
    clear():void {
        this.state.data = {};
        window.sessionStorage.removeItem(accessKey);
    }

    /**
     * Returns number of selected rows
     *List.filter(([k,]) => k !== queryKey)
     * @returns {number}
     */
    size():number {
        return Dict.size(this.state.data) - 1; // 1 <= spec. __query__ key
    }

    getMode():LineSelectionModes {
        return pipe(
            this.state.data,
            Dict.toEntries(),
            queryKeyFilter,
            List.some(([,[,grp]]) => !!grp)
        ) ? 'groups' : 'simple';
    }

    setMode(mode:LineSelectionModes):void {
        if (mode === 'simple') {
            this.state.data = pipe(
                this.state.data,
                Dict.map(([line,], k) => k !== queryKey ?
                    tuple(line, null) : tuple(this.queryId, -1))
            );;

        } else if (mode === 'groups') {
            this.state.data = pipe(
                this.state.data,
                Dict.map(
                    ([line,], k) => k !== queryKey ?
                        tuple(line, ConcLinesStorage.DEFAULT_GROUP_ID) :
                        tuple(this.queryId, -1)
                )
            );
        }
    }

    toJSON():string {
        return JSON.stringify(this.state.data);
    }

    /**
     * Stores data into a sessionStorage as a JSON object
     */
    serialize():void {
        try {
            window.sessionStorage[accessKey] = this.toJSON();
        } catch (e) {
            if (e.name === 'QUOTA_EXCEEDED_ERR') {
                console.error('Failed to store selected concordance lines due to exceeded data limit.');
                if (typeof this.errorHandler === 'function') {
                    this.errorHandler.call(this, e);
                }
            }
        }
    }

    private queryChecksum(q:string):number {
        let cc = 0;
        for(let i = 0; i < q.length; i += 1) {
            cc = (cc << 5) - cc + q.charCodeAt(i);
            cc &= cc;
        }
        return cc;
    }
}

/**
 * @param {function} [errorHandler] see ConcLinesStorage documentation
 * @returns {ConcLinesStorage}
 */
export function openStorage(errorHandler):ConcLinesStorage {
    return new ConcLinesStorage(errorHandler);
}
