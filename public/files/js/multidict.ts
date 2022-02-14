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
 * MultiDict is a multi-value dictionary which converts
 * all the incoming values into strings. Its main purpose
 * is to collect params for HTTP requests.
 */
export class MultiDict<T={[k:string]:string|number|boolean}> implements Kontext.IMultiDict<T> {

    private readonly data:{[K in keyof T]?:Array<string>};

    constructor(data?:Array<[keyof T, T[keyof T]]>) {
        this.data = {};
        if (Array.isArray(data)) {
            for (let i = 0; i < data.length; i += 1) {
                const [k, v] = data[i];
                if (this.data[k] === undefined) {
                    this.data[k] = [];
                }
                if (this.importValue(v) !== undefined) {
                    this.data[k].push(this.importValue(v));
                }
            }
        }
    }

    static fromDict<U>(data:{[k in keyof U]:U[keyof U]}):MultiDict<U> {
        const ans = new MultiDict<U>();
        for (let k in data) {
            ans.set(k, data[k] as U[keyof U]);
        }
        return ans;
    }

    private importValue(v:T[keyof T]):string|undefined {
        if ((typeof v === 'string' && v === '') || v === null || v === undefined) {
            return undefined;

        } else if (typeof v === 'boolean') {
            return v ? '1' : '0';
        }
        return v + '';
    }

    size():number {
        return Object.keys(this.data).length;
    }

    /**
     * Return first item matching a provided key. In case the key is not
     * found or the matching array is empty, undefined is returned.
     */
    head<K extends keyof T>(key:K):string {
        return this.data[key] !== undefined ? this.data[key][0] : undefined;
    }

    getList<K extends keyof T>(key:K):Array<string> {
        return this.data[key] !== undefined ? this.data[key] : [];
    }

    /**
     * Set a new value. In case there is
     * already a value present it is removed
     * first.
     */
    set<K extends keyof T>(key:K, value:T[K]):Kontext.IMultiDict<T> {
        this.data[key] = [this.importValue(value)];
        return this;
    }

    /**
     * Replace the current list of values
     * associated with the specified key
     * with a provided list of values.
     */
    replace<K extends keyof T>(key:K, values:Array<T[K]>):Kontext.IMultiDict<T> {
        if (values.length > 0) {
            this.data[key] = values.map(this.importValue);

        } else {
            this.remove(key);
        }
        return this;
    }

    remove<K extends keyof T>(key:K):Kontext.IMultiDict<T> {
        delete this.data[key];
        return this;
    }

    /**
     * Add a new value. Traditional
     * dictionary mode rewrites current value
     * but the 'multi-value' mode appends the
     * value to the list of existing ones.
     */
    add<K extends keyof T>(key:K, value:T[K]):Kontext.IMultiDict<T> {
        if (this.data[key] === undefined) {
            this.data[key] = [];
        }
        this.data[key].push(this.importValue(value));
        return this;
    }

    /**
     * Return a list of key-value pairs.
     */
    items():Array<[string, string]> {
        let ans = [];
        for (let p in this.data) {
            for (let i = 0; i < this.data[p].length; i += 1) {
                if (this.data[p][i] !== undefined) {
                    ans.push([p, this.data[p][i]]);
                }
            }
        }
        return ans;
    }

    /**
     * Return a copy of internal dictionary. If there
     * is more than one value for a key then first item is
     * returned.
     * If you expect keys with multiple values you should
     * use items() instead.
     */
    toDict():{[key:string]:string} {
        const ans:{[key:string]:string} = {};
        for (let k in this.data) {
            if (this.data.hasOwnProperty(k)) {
                ans[k] = this.data[k][0];
            }
        }
        return ans;
    }

    has<K extends keyof T>(key:K):boolean {
        return this.data.hasOwnProperty(key);
    }
}
