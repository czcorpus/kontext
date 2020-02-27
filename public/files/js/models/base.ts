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
 * Synchronized model represents a way how to synchronize
 * (as master) stateful model with its depending
 * models (both stateful and stateless) in case we do not
 * want (or cannot) intercept master's action internals.
 *
 * If a model is expected to be a master for some
 * synchronization it is recommended to use one of
 * basic model classes supporting this method and
 * call the function once async operations are
 * done. For an action 'SOME_ACTION' this produces
 * additional action '@SOME_ACTION' to which
 * dependent models can respond.
 *
 * Using of this class is deprecated and all the
 * implementation should be done via StatelessModel<T>
 * and its "sideEffect" and "suspend" capabilities.
 */
export class UNSAFE_SynchronizedModel extends StatefulModel {

    constructor(dispatcher:IFullActionControl) {
        super(dispatcher);
    }

    synchronize(action:string, props:Kontext.GeneralProps):void {
        if (action.substr(0, 1) !== '@') {
            this.dispatcher.dispatch({
                name: '@' + action,
                payload: props
            });

        } else {
            throw new Error('Cannot commit synchronization action');
        }
        this.emitChange();
    }
}

/**
 * A function implemented by a React component
 * to listen for changes in a stateless model.
 */
export interface StatelessModelListener<T> {
    (state:T, error?:Error):void;
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

/**
 * Create a shallow copy of an object.
 * @param obj
 */
export function cloneRecord<T extends Object>(obj:T):T {
    const ans:any = {};
    for (let p in obj) {
        if (obj.hasOwnProperty(p)) {
            ans[p] = obj[p];
        }
    }
    return <T>ans;
}

export function setFormItemInvalid(item:Kontext.FormValue<string>, isInvalid:boolean):Kontext.FormValue<string> {
    return {
        value: item.value,
        isInvalid: isInvalid,
        isRequired: item.isRequired
    };
}
