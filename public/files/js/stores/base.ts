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

import * as Rx from '@reactivex/rxjs';
import {ActionDispatcher, ActionPayload, IReducer} from '../app/dispatcher';

/**
 * A base class for KonText's Flux stores.
 */
export class SimplePageStore implements Kontext.PageStore {

    dispatcher:ActionDispatcher;

    private changeListeners:Array<Kontext.StoreListener>;

    public static CHANGE_EVENT:string = 'change';

    constructor(dispatcher:ActionDispatcher) {
        this.dispatcher = dispatcher;
        this.changeListeners = [];
    }

    dispatcherRegister(fn:(payload:ActionPayload)=>void):void {
        this.dispatcher.register(fn);
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
}


/**
 * Synchronized model represents a way how to synchronize
 * different models in case of asynchronous operations
 * even in case we cannot intercept core action chain
 * (e.g. in case a plug-in needs to attach itself to
 * a core action - this is probably the case even ActionCreator
 * cannot be used for).
 *
 * If a model is expected to be a master for some
 * synchronization it is recommended to use one of
 * basic model classes supporting this method and
 * call the function once async operations are
 * done. For an action 'SOME_ACTION' this produces
 * additional action '$SOME_ACTION' to which
 * dependent stores can respond.
 */
export interface ISynchronizedModel<T> {
    synchronize(action:string, payload:T):void;
}


/**
 *
 */
export class SynchronizedModel extends SimplePageStore implements ISynchronizedModel<Kontext.GeneralProps> {

    constructor(dispatcher:ActionDispatcher) {
        super(dispatcher);
    }

    synchronize(action:string, props:Kontext.GeneralProps):void {
        if (action.substr(0, 1) !== '$') {
            this.dispatcher.dispatch({
                actionType: '$' + action,
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
 * StatelessModel is a most recent component model implementation
 * inspired by some Flux/Redux ideas. The model is expected to
 * provide state transformation methods but it does not control
 * the state change directly. The implementation is based on Rx.js
 * streams.
 */
export abstract class StatelessModel<T> implements ISynchronizedModel<T>, IReducer<T> {

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
    abstract reduce(state:T, action:ActionPayload):T;

    /**
     * A function used by React component to listen for
     * changes in a state handled by this model.
     */
    addChangeListener(fn:StatelessModelListener<T>):void {
        const subsc = this.state$.subscribe(fn);
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

    synchronize(action:string, state:T):void {
        if (action.substr(0, 1) !== '$') {
            this.dispatcher.dispatch({
                actionType: '$' + action,
                props: state
            });

        } else {
            throw new Error('Cannot commit synchronization action');
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
     * A helper function to create a shallow copy
     * of a provided state. It is expected that
     * all the values inside are immutable.
     */
    copyState(state:T):T {
        if (Object.assign) {
            return <T>Object.assign({}, state);

        } else {
            const ans:{[key:string]:any} = {};
            for (let p in state) {
                if (state.hasOwnProperty(p)) {
                    ans[p] = state[p];
                }
            }
            return <T>ans;
        }
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
