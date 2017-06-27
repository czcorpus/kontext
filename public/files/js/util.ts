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

/// <reference path="./types/common.d.ts" />


/**
 * Transform a dict to a list of pairs. In case
 * a value is Array<T> then it is expanded as a list
 * of pairs with the same first value.
 */
export function dictToPairs<T>(d:{[key:string]:T|Array<T>}):Array<[string, T]> {
    const ans = [];
    for (let k in d) {
        if (d.hasOwnProperty(k)) {
            if (Object.prototype.toString.call(d[k]) === '[object Array]') {
                (<Array<T>>d[k]).forEach((item) => {
                    ans.push(k, item);
                });

            } else {
                ans.push([k, d[k]]);
            }
        }
    }
    return ans;
}


/**
 * Parse a URL args string (k1=v1&k2=v2&...&kN=vN) into
 * a list of pairs [[k1, v1], [k2, v2],...,[kN, vN]]
 */
export function parseUrlArgs(args:string):Array<[string, string]> {
    return args.split('&').map<[string, string]>(item => {
        const tmp = item.split('=', 2);
        return [decodeURIComponent(tmp[0]), decodeURIComponent(tmp[1])];
    });
}

// --------------------------- COLOR related functions --------------------

export function color2str(c:Kontext.RGBAColor):string {
    return c !== null ? `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${c[3]})` : 'transparent';
}

export function calcTextColorFromBg(bgColor:Kontext.RGBAColor):Kontext.RGBAColor {
    const color = bgColor ? bgColor : [255, 255, 255, 1];
    const lum = 0.2126 * color[0] + 0.7152 * color[1] + 0.0722 * color[2];
    return lum > 128 ? [1, 1, 1, 1] : [231, 231, 231, 1];
}

export function importColor(color:string, opacity:number):Kontext.RGBAColor {
    const fromHex = pos => parseInt(color.substr(2 * pos + 1, 2), 16);
    if (color.substr(0, 1) === '#') {
        return [
            fromHex(0),
            fromHex(1),
            fromHex(2),
            parseFloat(opacity.toFixed(1))
        ];

    } else if (color.toLowerCase().indexOf('rgb') === 0) {
        const srch = /rgb\((\d+),\s*(\d+),\s*(\d+)\s*(,\s*[\d\.]+)*\)/i.exec(color);
        if (srch) {
            return [
                parseInt(srch[1]),
                parseInt(srch[2]),
                parseInt(srch[3]),
                parseFloat(opacity.toFixed(1))
            ];

        } else {
            throw new Error('Cannot import color ' + color);
        }

    } else {
        throw new Error('Cannot import color ' + color);
    }
}

// ------------------------------------------------------------

/**
 * Update a general key-value object with an incoming one.
 * The function does not modify its parameters and returns
 * a new object with shallow copies of original values where
 * applicable (objects).
 *
 * @param myProps target properties
 * @param incomingProps incoming properties (these will rewrite
 *        the target in case of a property collision)
 */
export function updateProps(myProps:Kontext.GeneralProps,
        incomingProps:Kontext.GeneralProps):Kontext.GeneralProps {
    const ans = {};
    for (let p in myProps) {
        if (myProps.hasOwnProperty(p)) {
            ans[p] = myProps[p];
        }
    }
    for (let p in incomingProps) {
        if (incomingProps.hasOwnProperty(p)) {
            ans[p] = incomingProps[p];
        }
    }
    return ans;
}


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

    private _data:any;

    constructor(data?:Array<Array<string>>) {
        this._data = {};
        if (data !== undefined) {
            for (let i = 0; i < data.length; i += 1) {
                let k = data[i][0];
                let v = data[i][1];
                if (this._data[k] === undefined) {
                    this._data[k] = [];
                }
                this._data[k].push(v);
                this[k] = v;
            }
        }
    }

    size():number {
        let ans = 0;
        for (let p in this._data) {
            if (this._data.hasOwnProperty(p)) {
                ans += 1;
            }
        }
        return ans;
    }

    getFirst(key:string):string {
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
    set(key:string, value:any):void {
        this[key] = value;
        this._data[key] = [value];
    }

    /**
     * Replace the current list of values
     * associated with the specified key
     * with a provided list of values.
     */
    replace(key:string, values:Array<string>):void {
        if (values.length > 0) {
            this[key] = values[0];
            this._data[key] = values || [];

        } else {
            this.remove(key);
        }
    }

    remove(key:string):void {
        delete this[key];
        delete this._data[key];
    }

    /**
     * Add a new value. Traditional
     * dictionary mode rewrites current value
     * but the 'multi-value' mode appends the
     * value to the list of existing ones.
     */
    add(key:string, value:any):void {
        this[key] = value;
        if (this._data[key] === undefined) {
            this._data[key] = [];
        }
        this._data[key].push(value);
    }

    /**
     * Return a list of key-value pairs.
     */
    items():Array<[string, string]> {
        let ans = [];
        for (let p in this._data) {
            if (this._data.hasOwnProperty(p)) {
                for (let i = 0; i < this._data[p].length; i += 1) {
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
        let ans:{[key:string]:any} = {}; // TODO: type mess here
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
 * NullHistory is a fallback object to be used
 * in browsers where HTML5 history is not available.
 * (but the truth is, it won't help much anyway
 * as many different issues remain unsolved in
 * case of outdated browsers)
 */
export class NullHistory implements Kontext.IHistory {
    replaceState(action:string, args:Kontext.IMultiDict, stateData?:any, title?:string):void {}
    pushState(action:string, args:Kontext.IMultiDict, stateData?:any, title?:string):void {}
    setOnPopState(fn:(event:{state: any})=>void):void {}
}

/**
 * A simple wrapper around window.history object
 * with more convenient API.
 */
export class History implements Kontext.IHistory {

    private h:Kontext.IURLHandler;

    constructor(urlHandler:Kontext.IURLHandler) {
        this.h = urlHandler;
    }

    /**
     * Replace the current state with the one specified by passed arguments.
     *
     * @param action action name (e.g. 'first_form', 'subcorpus/subcorp_list')
     * @param args a multi-dict instance containing URL arguments to be used
     * @param stateData (just like in window.history.replaceState)
     * @param title (just like in window.history.replaceState), default is window.document.title
     */
    replaceState(action:string, args:Kontext.IMultiDict, stateData?:any, title?:string):void {
        if (/^https?:\/\//.exec(action)) {
            throw new Error('Invalid action specifier (cannot use URL here)');
        }
        window.history.replaceState(
            stateData || {},
            title || window.document.title,
            `${this.h.createActionUrl(action)}?${this.h.encodeURLParameters(args)}`
        );
    }

    /**
     * Push a new state
     *
     * @param action action name (e.g. 'first_form', 'subcorpus/subcorp_list')
     * @param args a multi-dict instance containing URL arguments to be used
     * @param stateData (just like in window.history.replaceState)
     * @param title (just like in window.history.replaceState), default is window.document.title
     */
    pushState(action:string, args:Kontext.IMultiDict, stateData?:any, title?:string):void {
        if (/^https?:\/\//.exec(action)) {
            throw new Error('Invalid action specifier (cannot use URL here)');
        }
        window.history.pushState(
            stateData || {},
            title || window.document.title,
            `${this.h.createActionUrl(action)}?${this.h.encodeURLParameters(args)}`
        );
    }

    setOnPopState(fn:(event:{state: any})=>void):void {
        window.onpopstate = fn;
    }
}
