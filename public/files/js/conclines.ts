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


const accessKey = 'concLines';
const queryKey = '__query__';

/**
 * Loads all the selection data from local storage.
 * If nothing is found then new entry is created
 *
 */
function loadAll() {
    var data;

    try {
        data = JSON.parse(window.sessionStorage[accessKey]) || {};

    } catch (e) {
        window.sessionStorage[accessKey] = '{}';
        data = {};
    }
    return data;
}

/**
 * This object is used for accessing stored concordance lines and is based on
 * browser's sessionStorage. Individual changes (via addLine(), removeLine())
 * are not stored immediately. It is up to programmer to use method serialize()
 * (e.g. using window's unload event) to make changes session-permanent.
 */
export class ConcLinesStorage {



    errorHandler:any; // TODO type

    static DEFAULT_GROUP_ID = 1;

    constructor(errorHandler) {
        this.errorHandler = errorHandler;
    }

    init(queryId:number):void {
        if (this.data[queryKey] && this.data[queryKey][0] !== queryId) {
            this.clear();
        }
        this.data[queryKey] = [queryId, -1];
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
        this.data[id] = [kwiclen, category];
    }

    removeLine(id):void {
        delete this.data[id];
    }

    containsLine(id:string):boolean {
        return this.data.hasOwnProperty(id);
    }

    getLine(id:string):any { // TODO return type
        return this.data[id] || null;
    }

    private iterateItems(fn:(ident:string, value:[number, number])=>boolean):void {
        for (let p in this.data) {
            if (this.data.hasOwnProperty(p) && p !== queryKey) {
                if (!fn(p, this.data[p])) {
                    break;
                }
            }
        }
    }

    /**
     * Returns all the selected lines. Each line
     * is encoded like this: [kwic_token_id, kwic_len, line_number, category].
     */
    getAll():any {
        const ans = [];
        this.iterateItems((p, val) => {
            ans.push([parseInt(p, 10)].concat(val.slice(0)));
            return true;
        });
        return ans;
    }

    /**
     * Removes all the elements and writes the change into sessionStorage
     */
    clear():void {
        this.data = {};
        window.sessionStorage.removeItem(accessKey);
    }

    /**
     * Returns number of selected rows
     *
     * @returns {number}
     */
    size():number {
        let total = 0;

        if (!Object.keys) {  // let IE8 and his older friends suffer
            this.iterateItems((p, val) => {
                total += 1;
                return true;
            });

        } else {
            total = Object.keys(this.data).length;
            if (this.data.hasOwnProperty(queryKey)) {
                total -= 1;
            }
        }
        return total;
    }

    getMode():string {
        let ans = 'simple';
        this.iterateItems((p, val) => {
            if (val[1] != null) {
                ans = 'groups';
                return false;
            }
        });
        return ans;
    }

    setMode(mode:string):void {
        if (mode === 'simple') {
            this.iterateItems((p, _) => {
                this.data[p][1] = null;
                return true;
            });

        } else if (mode === 'groups') {
            this.iterateItems((p, _) => {
                this.data[p][1] = ConcLinesStorage.DEFAULT_GROUP_ID;
                return true;
            });
        }
    }

    getAsJson():string {
        return JSON.stringify(this.data);
    }

    /**
     * Stores data into a sessionStorage as a JSON object
     */
    serialize():void {
        try {
            window.sessionStorage[accessKey] = this.getAsJson();
        } catch (e) {
            if (e.name === 'QUOTA_EXCEEDED_ERR') {
                console.error('Failed to store selected concordance lines due to exceeded data limit.');
                if (typeof this.errorHandler === 'function') {
                    this.errorHandler.call(this, e);
                }
            }
        }
    }
}

/**
 * @param {function} [errorHandler] see ConcLinesStorage documentation
 * @returns {ConcLinesStorage}
 */
export function openStorage(errorHandler):ConcLinesStorage {
    return new ConcLinesStorage(errorHandler);
}
