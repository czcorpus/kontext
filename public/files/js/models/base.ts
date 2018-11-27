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
import * as Rx from '@reactivex/rxjs';
import {ActionDispatcher, Action, IReducer, SEDispatcher} from '../app/dispatcher';

/**
 * A base class for KonText's legacy models.
 */
export class StatefulModel implements Kontext.EventEmitter {

    dispatcher:ActionDispatcher;

    private changeListeners:Array<Kontext.ModelListener>;

    public static CHANGE_EVENT:string = 'change';

    constructor(dispatcher:ActionDispatcher) {
        this.dispatcher = dispatcher;
        this.changeListeners = [];
    }

    dispatcherRegister(fn:(action:Action)=>void):void {
        this.dispatcher.register(fn);
    }

    /**
     * Function for React components to register model change listening.
     * (typically on 'componentDidMount()')
     * @param fn
     */
    addChangeListener(fn:Kontext.ModelListener):void {
        this.changeListeners.push(fn);
    }

    /**
     * Function for React components to unregister from model change listening.
     * (typically on 'componentWillUnmount()')
     * @param fn
     */
    removeChangeListener(fn:Kontext.ModelListener):void {
        for (var i = 0; i < this.changeListeners.length; i += 1) {
            if (this.changeListeners[i] === fn) {
                this.changeListeners.splice(i, 1);
                break;
            }
        }
    }

    /**
     * This method is used to notify all the registered listeners about
     * change in models internal state.
     *
     * Please note that using eventType and error is deprecated! I.e. models
     * should only notify about change in their state and it is up to
     * a concrete React component how it will determine (via fetching model's
     * state using its getters) how to react.
     *
     * @param eventType
     * @param error
     */
    notifyChangeListeners(eventType:string=StatefulModel.CHANGE_EVENT, error:Error=null):void {
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
 * Please note that in case of StatelessModel<T>
 * this is accomplished via its side-effect handler
 * function which is more general but it can easily
 * handle synchronization too.
 */
export class UNSAFE_SynchronizedModel extends StatefulModel {

    constructor(dispatcher:ActionDispatcher) {
        super(dispatcher);
    }

    synchronize(action:string, props:Kontext.GeneralProps):void {
        if (action.substr(0, 1) !== '@') {
            this.dispatcher.dispatch({
                actionType: '@' + action,
                props: props
            });

        } else {
            throw new Error('Cannot commit synchronization action');
        }
        this.notifyChangeListeners();
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
 * StatelessModel is a most recent (and recommended) component
 * model implementation inspired by some Flux/Redux ideas. The
 * model is expected to provide state transformation methods but
 * it does not control the state change directly (it even cannot
 * notify views about a change). The implementation is based on
 * Observable streams.
 *
 * In case side-effects are needed (both synchronous & asynchronous),
 * it is possible to register a callback function which is called
 * once the model reduction is performed. The callback can produce
 * additional actions based on the current action and state.
 */
export abstract class StatelessModel<T> implements IReducer<T> {

    private state$:Rx.BehaviorSubject<T>;

    private dispatcher:ActionDispatcher;

    private subscriptions:Array<[StatelessModelListener<T>, Rx.Subscription]>;

    constructor(dispatcher:ActionDispatcher, initialState:T) {
        this.dispatcher = dispatcher;
        this.subscriptions = [];
        this.state$ = dispatcher.createStateStream$(this, initialState);
    }

    /**
     * This function defines how a model responds to different
     * actions. Please make sure that the function returns a
     * state for any action - for unsupported actions the best
     * response is the original state (which makes React rendering
     * more effective).
     */
    abstract reduce(state:T, action:Action):T;

    sideEffects(state:T, action:Action, dispatch:SEDispatcher):void {};

    /**
     * A function used by React component to listen for
     * changes in a state handled by this model.
     */
    addChangeListener(fn:StatelessModelListener<T>):void {
        const subsc = this.state$.subscribe({
            next: fn,
            error: (err) => console.error(err)
        });
        this.subscriptions.push([fn, subsc]);
    }

    removeChangeListener(fn:StatelessModelListener<T>):void {
        for (var i = 0; i < this.subscriptions.length; i += 1) {
            if (this.subscriptions[i][0] === fn) {
                this.subscriptions[i][1].unsubscribe();
                this.subscriptions.splice(i, 1);
                break;
            }
        }
    }

    /**
     * Return current state. This is typically used only
     * in React components' constructors to set their initial
     * state.
     */
    getState():T {
        return this.state$.getValue();
    }

    /**
     * A helper function to create a shallow (except for
     * Kontext.FormValue<T> values - see below) copy
     * of a provided state. It is expected that
     * all the values inside are immutable.
     *
     * The only value with a special treatment is
     * Kontext.FormValue which is expected to be used
     * a lot (basically any form value should be wrapped
     * in Kontext.FormValue) and thus the method copies it
     * in an immutable way to prevent messed state.
     */
    copyState(state:T):T {
        const ans:{[key:string]:any} = {};
        for (let p in state) {
            if (state.hasOwnProperty(p)) {
                const v = state[p];
                if (Kontext.isFormValue(v)) {
                    ans[p] = {
                        value: v.value,
                        isRequired: v.isRequired,
                        isInvalid: v.isInvalid
                    };

                } else {
                    ans[p] = v;
                }
            }
        }
        return <T>ans;
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
