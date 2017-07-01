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
 *
 */
export class SimplePageStore implements Kontext.PageStore {

    dispatcher:Kontext.FluxDispatcher;

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

    constructor(dispatcher:Kontext.FluxDispatcher) {
        this.dispatcher = dispatcher;
        this.changeListeners = [];
    }
}


    export function validateNumber(s:string):boolean {
        return !!/^-?([1-9]\d*|0)?$/.exec(s);
    }

    export function validateGzNumber(s:string):boolean {
        return !!/^([1-9]\d*)?$/.exec(s);
    }