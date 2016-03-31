/*
 * Copyright (c) 2016 Institute of the Czech National Corpus
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

/// <reference path="../ts/declarations/rsvp.d.ts" />

import RSVP = require('vendor/rsvp');

/**
 * This object stores all the initialization actions performed on page when
 * it loads. These actions may be asynchronous in general which is why a Promise
 * objects are required here. If an action si synchronous then it may return null/undefined
 * @todo this should be either finished (and respected by action pages) or rewritten in some way
 */
export class InitActions {

    prom:{[k:string]:any};

    constructor() {
        this.prom = {};
    }

    /**
     * Adds one (.add(key, promise)) or multiple (.add({...})) promises to the collection.
     * Returns self.
     *
     * Please note that actions added simultaneously are considered
     * as independent. To chain actions together use doAfter() method.
     */
    add<T>(arg0:string, arg1:RSVP.Promise<T>):InitActions;
    add(arg0:{[name:string]:any}, arg1?):InitActions;
    add(arg0, arg1):InitActions {
        var prop;

        if (typeof arg0 === 'object' && arg1 === undefined) {
            for (prop in arg0) {
                if (arg0.hasOwnProperty(prop)) {
                    this.prom[prop] = arg0[prop];
                }
            }

        } else if (typeof arg0 === 'string' && arg1 !== undefined) {
            this.prom[arg0] = arg1;
        }
        return this;
    }

    /**
     * Tests whether there is a promise with the 'key'
     *
     */
    contains(key):boolean {
        return this.prom.hasOwnProperty(key);
    }

    /**
     * Gets a promise of the specified name. In case
     * no such init action exists, error is thrown.
     */
    get<T>(key):RSVP.Promise<T> {
        if (this.contains(key)) {
            return this.prom[key];

        } else {
            throw new Error('No such init action: ' + key);
        }
    }

    /**
     * Binds a function to be run after a promise
     * identified by 'actionId' is fulfilled. In case
     * there is no promise under the 'actionId' key (please
     * note that the key must be still present) then
     * ad-hoc one is created and immediately resolved.
     *
     * type T specifies a value returned by actionId action
     * type U specifies a value function fn is producing
     *
     * @param actionId - an identifier of an action (= any function initializing
     * a part of a page and registered via the add() method)
     * @param fn - a function to be run after the action 'actionId' is finished
     */
    doAfter<T, U>(actionId:string, fn:(prev?:T)=>U):RSVP.Promise<U> {
        let prom1:RSVP.Promise<T>;
        let self = this;

        prom1 = this.get(actionId);
        if (prom1 instanceof RSVP.Promise) {
            return prom1.then<U>((v:T) => fn(v));

        } else {
            return new RSVP.Promise(function (fulfill, reject) {
                try {
                    fulfill(fn(self.prom[actionId]));

                } catch (err) {
                    reject(err);
                }
            });
        }
    }
}