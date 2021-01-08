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

import { List, pipe, tuple, Ident } from 'cnc-tskit';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';


import { LineSelections, LineSelectionModes, ConcLineSelection } from './common';
import { IActionDispatcher } from 'kombo';
import { Actions, ActionName } from './actions';



export interface StorageUsingState {
    data:LineSelections;
    queryHash:string;
    isLocked:boolean;
}

/**
 * This object is used for accessing stored concordance lines and is based on
 * browser's sessionStorage. Individual changes (via addLine(), removeLine())
 * are not stored immediately. It is up to programmer to use method serialize()
 * (e.g. using window's unload event) to make changes session-permanent.
 */
export class ConcLinesStorage<T extends StorageUsingState> {

    private static ACC_KEY = 'concLines';

    private static MAX_SELECTION_AGE_SECS = 3600 * 24 * 7;

    errorHandler:(err:Error)=>void;

    public static DEFAULT_GROUP_ID = 1;

    private static WRITE_THROTTLE_INTERVAL = 400;

    private writeEvents:Subject<number>;

    constructor(dispatcher:IActionDispatcher, errorHandler:(err:Error)=>void) {
        this.errorHandler = errorHandler;
        this.writeEvents = new Subject<number>();
        this.writeEvents.pipe(
            debounceTime(ConcLinesStorage.WRITE_THROTTLE_INTERVAL)

        ).subscribe(
            () => {
                dispatcher.dispatch<Actions.SaveLineSelection>({
                    name: ActionName.SaveLineSelection
                });
            }
        )
    }

    init(state:T, query:Array<string>):T {
        state.queryHash = Ident.hashCode(query.join(''));
        try {
            const curr = JSON.parse(window.sessionStorage.getItem(
                ConcLinesStorage.ACC_KEY));
            state.data = {... curr, ...state.data};

        } catch (e) {
            console.error('Failed to deserialize line selection data, removing');
            window.sessionStorage.removeItem(
                ConcLinesStorage.ACC_KEY);
        }

        if (this.recIsExpired(state)) {
            this.clear(state);
        }
        if (state.data[state.queryHash] === undefined) {
            state.data[state.queryHash] = {
                created: new Date().getTime() / 1000,
                mode: 'simple',
                selections: []
            };
            this.serialize(state.data);

        }
        if (state.isLocked) {
            state.data[state.queryHash].mode = 'groups';
        }
        return state;
    }

    private recIsExpired(state:T):boolean {
        if (state.data[state.queryHash]) {
            const age = (new Date()).getTime() / 1000 - this.actualData(state).created;
            return age > ConcLinesStorage.MAX_SELECTION_AGE_SECS;
        }
        return false;
    }

    actualData(state:T):ConcLineSelection {
        return state.data[state.queryHash] || {
            created: new Date().getTime() / 1000,
            mode: 'simple',
            selections: []
        };
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
    addLine(state:T, tokenId:number, kwiclen:number, category:number):void {
        const srchIdx = List.findIndex(([tokId,,]) => tokId === tokenId, this.actualData(state).selections);
        if (srchIdx === -1) {
            state.data[state.queryHash].selections.push(tuple(tokenId, kwiclen, category));

        } else {
            state.data[state.queryHash].selections[srchIdx] = tuple(tokenId, kwiclen, category);
        }
        this.writeEvents.next(new Date().getTime());
    }

    removeLine(state:T, tokenId:number):void {
        const srchIdx = List.findIndex(
            ([tokId,,]) => tokId === tokenId,
            this.actualData(state).selections
        );
        if (srchIdx > -1) {
            this.actualData(state).selections.splice(srchIdx, 1);
            this.writeEvents.next(new Date().getTime());
        }
    }

    containsLine(state:T, tokenId:number):boolean {
        return List.some(([tokId,,]) => tokId === tokenId, this.actualData(state).selections);
    }

    getLine(state:T, tokenId:number):[number, number, number]|undefined {
        return List.find(([tokId,,]) => tokId === tokenId, this.actualData(state).selections);
    }

    /**
     * Returns all the selected lines. Each line
     * is encoded like this: [kwic_token_id, kwic_len, category].
     */
    exportAll(state:T):Array<[number, number, number]> {
        return this.actualData(state).selections;
    }

    /**
     * Removes all the elements for a queryHash or for all stored queries
     */
    clear(state:T, queryHash?:string):void {
        if (queryHash) {
            state.data[queryHash] = {...state.data[queryHash], selections: []};
            this.serialize(state.data);

        } else {
            state.data = {};
            window.sessionStorage.removeItem(ConcLinesStorage.ACC_KEY);
        }
    }

    /**
     */
    size(state:T):number {
        return this.actualData(state).selections.length;
    }

    getMode(state:T):LineSelectionModes {
        return this.actualData(state).mode;
    }

    setMode(state:T, mode:LineSelectionModes):void {
        if (mode === 'simple') {
            state.data[state.queryHash].mode = 'simple';
            state.data[state.queryHash].selections = pipe(
                this.actualData(state).selections,
                List.map(([tokenId, kwicLen,]) => tuple(
                    tokenId,
                    kwicLen,
                    ConcLinesStorage.DEFAULT_GROUP_ID
                ))
            );
            this.writeEvents.next(new Date().getTime());

        } else if (mode === 'groups') {
            state.data[state.queryHash].mode = 'groups';
            state.data[state.queryHash].selections = pipe(
                this.actualData(state).selections,
                List.map(([tokenId, kwicLen,]) => tuple(
                        tokenId,
                        kwicLen,
                        ConcLinesStorage.DEFAULT_GROUP_ID
                ))
            );
            this.writeEvents.next(new Date().getTime());
        }
    }

    toJSON(selections:LineSelections):string {
        return JSON.stringify(selections);
    }

    /**
     * Stores data into a sessionStorage as a JSON object
     */
    serialize(selections:LineSelections):void {
        try {
            window.sessionStorage[ConcLinesStorage.ACC_KEY] = this.toJSON(selections);
        } catch (e) {
            if (e.name === 'QUOTA_EXCEEDED_ERR') {
                console.error(
                    'Failed to store selected concordance lines due to exceeded data limit.');
                if (typeof this.errorHandler === 'function') {
                    this.errorHandler.call(this, e);
                }
            }
        }
    }

}

/**
 */
export function openStorage<T extends StorageUsingState>(dispatcher:IActionDispatcher, errorHandler:any):ConcLinesStorage<T> {
    return new ConcLinesStorage(dispatcher, errorHandler);
}
