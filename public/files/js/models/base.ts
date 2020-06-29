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

import {Kontext} from '../types/common';
import { IEventEmitter, Action, IFullActionControl } from 'kombo';
import { Subscription, Observable, Subject } from 'rxjs';
import { share } from 'rxjs/operators';

/**
 * A base class for KonText's legacy models. Using this model
 * is deprecated. In case you have to implement a stateful model,
 * please use Kombo's StatefulModel instead as it provides easier
 * integration with React component properties and has separated
 * state properties from "internal" ones.
 */
export class StatefulModel implements IEventEmitter {

    dispatcher:IFullActionControl;

    private changeTicks:Subject<{}>;

    private sharedTicks:Observable<{}>;

    public static CHANGE_EVENT:string = 'change';

    private subscription:Subscription;

    constructor(dispatcher:IFullActionControl) {
        this.dispatcher = dispatcher;
        this.changeTicks = new Subject();
        this.sharedTicks = this.changeTicks.pipe(share());
    }

    dispatcherRegister(fn:(action:Action)=>void):void {
        this.subscription = this.dispatcher.registerActionListener(fn);
    }

    /**
     * Function for React components to register model change listening.
     * (typically on 'componentDidMount()')
     * @param fn
     */
    addListener(fn:Kontext.ModelListener):Subscription {
        return this.sharedTicks.subscribe(fn);
    }

    /**
     * This method is used to notify all the registered listeners about
     * change in models internal state.
     */
    emitChange():void {
        this.changeTicks.next();
    }

    unregister():void {
        this.subscription.unsubscribe();
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

export function setFormItemInvalid(item:Kontext.FormValue<string>,
        isInvalid:boolean):Kontext.FormValue<string> {
    return {...item, isInvalid};
}
