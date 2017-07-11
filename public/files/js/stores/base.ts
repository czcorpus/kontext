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

/// <reference path="../types/common.d.ts" />

/**
 * A base class for KonText's Flux stores.
 */
export class SimplePageStore implements Kontext.PageStore {

    dispatcher:Kontext.FluxDispatcher;

    private changeListeners:Array<Kontext.StoreListener>;

    public static CHANGE_EVENT:string = 'change';

    private throttlingTimeouts:{[id:string]:number};

    private static THROTTLING_TIMEOUT_MS = 300;

    constructor(dispatcher:Kontext.FluxDispatcher) {
        this.dispatcher = dispatcher;
        this.changeListeners = [];
        this.throttlingTimeouts = {};
    }

    /**
     * Function for React components to register store change listening.
     * (typically on 'componentDidMount()')
     * @param fn
     */
    addChangeListener(fn:Kontext.StoreListener):void {
        this.changeListeners.push(fn);
    }

    /**
     * Function for React components to unregister from store change listening.
     * (typically on 'componentWillUnmount()')
     * @param fn
     */
    removeChangeListener(fn:Kontext.StoreListener):void {
        for (var i = 0; i < this.changeListeners.length; i += 1) {
            if (this.changeListeners[i] === fn) {
                this.changeListeners.splice(i, 1);
                break;
            }
        }
    }

    /**
     * This method is used to notify all the registered listeners about
     * change in stores internal state.
     *
     * Please note that using eventType and error is deprecated! I.e. stores
     * should only notify about change in their state and it is up to
     * a concrete React component how it will determine (via fetching store's
     * state using its getters) how to react.
     *
     * @param eventType
     * @param error
     */
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

    /**
     * This method is intended to be used for delayed
     * value validation (i.e. we give user a time to write
     * a correct value and then run the validation).
     * @param id
     * @param fn
     */
    protected throttleAction(id:string, fn:()=>void):void {
        if (this.throttlingTimeouts.hasOwnProperty(id)) {
            window.clearTimeout(this.throttlingTimeouts[id]);
        }
        this.throttlingTimeouts[id] = window.setTimeout(() => {
            fn();
            delete this.throttlingTimeouts[id];
        }, SimplePageStore.THROTTLING_TIMEOUT_MS);
    }
}


/**
 * Test whether a string 's' represents an integer
 * number.
 */
export function validateNumber(s:string):boolean {
    return !!/^-?([1-9]\d*|0)?$/.exec(s);
}

/**
 * Test whether a string 's' represents an integer
 * number greater than zero.
 */
export function validateGzNumber(s:string):boolean {
    return !!/^([1-9]\d*)?$/.exec(s);
}