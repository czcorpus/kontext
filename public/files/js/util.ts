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

    addChangeListener(fn:Kontext.StoreListener):void {
        this.changeListeners.push(fn);
    }

    removeChangeListener(fn:Kontext.StoreListener):void {
        for (var i = 0; i < this.changeListeners.length; i += 1) {
            if (this.changeListeners[i] === fn) {
                this.changeListeners.splice(i, 1);
                break;
            }
        }
    }

    notifyChangeListeners(eventType:string=SimplePageStore.CHANGE_EVENT, error:Error=null):void {
        const handlers = this.changeListeners.slice(0);
        for (let i = 0; i < handlers.length; i += 1) {
            try {
                // please note that the first arg has no effect on arrow functions
                handlers[i].call(this, this, eventType, error);

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

    getList(key:string):Array<string> {
        return this._data[key];
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
        this[key] = values[0];
        this._data[key] = values || [];
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
        let ans:{[key:string]:string} = {};
        for (let k in this) {
            if (this.hasOwnProperty(k)) {
                ans[k] = this[k];
            }
        }
        return ans;
    }
}

export class NullHistory implements Kontext.IHistory {
    replaceState(action:string, args:Kontext.IMultiDict, stateData?:any, title?:string):void {}
    pushState(action:string, args:Kontext.IMultiDict, stateData?:any, title?:string):void {}
    setOnPopState(fn:(event:{state: any})=>void):void {}
}


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
