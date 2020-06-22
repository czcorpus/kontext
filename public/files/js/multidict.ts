/*
 * Copyright (c) 2013 Institute of the Czech National Corpus
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

import { Kontext } from './types/common';



/**
 * A dictionary which mimics Werkzeug's Multidict
 * type. It provides:
 * 1) traditional d[k] access to a single value
 * 2) access to a list of values via getlist(k)
 *
 * Values can be also modifed but the only
 * reliable way is to use set(k, v), add(k, v) methods
 * (d[k] = v cannot set internal dict containing lists
 * of values).
 */
export class MultiDict implements Kontext.IMultiDict {

    private readonly _data:{[key:string]:Array<string>};

    constructor(data?:Array<[string, string|number|boolean]>) {
        this._data = {};
        if (data !== undefined) {
            for (let i = 0; i < data.length; i += 1) {
                const [k, v] = data[i];
                if (this._data[k] === undefined) {
                    this._data[k] = [];
                }
                this._data[k].push(this.importValue(v));
            }
        }
    }

    private importValue(v:string|number|boolean):string|undefined {
        if (v === '' || v === null || v === undefined) {
            return undefined;

        } else if (typeof v === 'boolean') {
            return v ? '1' : '0';
        }
        return v + '';
    }

    size():number {
        return Object.keys(this._data).length;
    }

    head(key:string):string {
        return this._data[key] !== undefined ? this._data[key][0] : undefined;
    }

    getList(key:string):Array<string> {
        return this._data[key] !== undefined ? this._data[key] : [];
    }

    /**
     * Set a new value. In case there is
     * already a value present it is removed
     * first.
     */
    set(key:string, value:number|boolean|string):void {
        this._data[key] = [this.importValue(value)];
    }

    /**
     * Replace the current list of values
     * associated with the specified key
     * with a provided list of values.
     */
    replace(key:string, values:Array<string|number|boolean>):void {
        if (values.length > 0) {
            this._data[key] = values.map(this.importValue);

        } else {
            this.remove(key);
        }
    }

    remove(key:string):void {
        delete this._data[key];
    }

    /**
     * Add a new value. Traditional
     * dictionary mode rewrites current value
     * but the 'multi-value' mode appends the
     * value to the list of existing ones.
     */
    add(key:string, value:number|string|boolean):void {
        this[key] = value;
        if (this._data[key] === undefined) {
            this._data[key] = [];
        }
        this._data[key].push(this.importValue(value));
    }

    /**
     * Return a list of key-value pairs.
     */
    items():Array<[string, string]> {
        let ans = [];
        for (let p in this._data) {
            for (let i = 0; i < this._data[p].length; i += 1) {
                if (this._data[p][i] !== undefined) {
                    ans.push([p, this._data[p][i]]);
                }
            }
        }
        return ans;
    }

    /**
     * Return a copy of internal dictionary holding last
     * value of each key. If you expect keys with multiple
     * values you should use items() instead.
     */
    toDict():{[key:string]:string} {
        const ans:{[key:string]:string} = {}; // TODO: type mess here
        for (let k in this._data) {
            if (this._data.hasOwnProperty(k)) {
                ans[k] = this._data[k][0];
            }
        }
        return ans;
    }

    has(key:string) {
        return this._data.hasOwnProperty(key);
    }
}

/**
 * note: this has only a limited reliability
 */
export function isTouchDevice():boolean {
    return 'ontouchstart' in window &&
        window.matchMedia('screen and (max-width: 479px)').matches;
}