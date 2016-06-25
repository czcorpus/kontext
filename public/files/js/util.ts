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
 *
 */
export class SimplePageStore implements Kontext.PageStore {

    dispatcher:Dispatcher.Dispatcher<any>;

    private changeListeners:Array<Kontext.StoreListener>;

    public static CHANGE_EVENT:string = 'change';

    public static ERROR_EVENT:string = 'error';

    addChangeListener = (fn:Kontext.StoreListener) => {
        this.changeListeners.push(fn);
    };

    removeChangeListener = (fn:Kontext.StoreListener) => {
        for (var i = 0; i < this.changeListeners.length; i += 1) {
            if (this.changeListeners[i] === fn) {
                this.changeListeners.splice(i, 1);
                break;
            }
        }
    };

    notifyChangeListeners(eventType:string=SimplePageStore.CHANGE_EVENT, error:Error=null):void {
        for (let i = 0; i < this.changeListeners.length; i += 1) {
            try {
                this.changeListeners[i].call(this, this, eventType, error);

            } catch (e) {
                console.error(e);
                throw e;
            }
        }
    }

    constructor(dispatcher:Dispatcher.Dispatcher<any>) {
        this.dispatcher = dispatcher;
        this.changeListeners = [];
    }
}


/**
 * Returns position (in number of characters) of cursor in a text input
 *
 * @param {Element|jQuery} inputElm
 * @return {number} position of cursor (starting from zero)
 */
export function getCaretPosition(inputElm) {
    var range,
        jqInputElm;

    if (inputElm instanceof jQuery) {
        jqInputElm = inputElm;
        inputElm = inputElm.get(0);

    } else {
        jqInputElm = $(inputElm);
    }
    if (window.getSelection) {
        jqInputElm.focus();
        return inputElm.selectionStart;

    } else if (window.document['selection']) { // < IE9
        jqInputElm.focus();
        range = window.document['selection'].createRange();
        range.moveStart('character', -jqInputElm.val().length);
        return range.text.length;
    }
    return 0;
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
export class MultiDict {

    private _data:any;

    constructor(data:Array<Array<string>>) {
        this._data = {};
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

    getList(key:string):Array<string> {
        return this._data[key];
    }

    /**
     * Set a new value. In case there is
     * already a value present it is removed
     * first.
     */
    set(key:string, value:any) {
        this[key] = value;
        this._data[key] = [value];
    }

    /**
     * Add a new value. Traditional
     * dictionary mode rewrites current value
     * but the 'multi-value' mode appends the
     * value to the list of existing ones.
     */
    add(key:string, value:any) {
        this[key] = value;
        if (this._data[key] === undefined) {
            this._data[key] = [];
        }
        this._data[key].push(value);
    }

    items():Array<Array<string>> {
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
     * value of each key.
     */
    toDict():{[key:string]:string} {
        let ans:{[key:string]:string} = {};
        for (let k in this._data) {
            if (this._data.hasOwnProperty(k)) {
                ans[k] = this._data[k];
            }
        }
        return ans;
    }
}
