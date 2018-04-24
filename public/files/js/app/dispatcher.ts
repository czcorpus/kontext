/*
 * Copyright (c) 2018 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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

import * as Rx from '@reactivex/rxjs';
import {Kontext} from '../types/common';


/**
 * A general flux/redux-like action object.
 */
export interface ActionPayload {

    /**
     * Upper case action identifier
     */
    actionType:string;

    /**
     * Action's arguments. A defined, non-null
     * object should be always used.
     */
    props:Kontext.GeneralProps;

    /**
     * An optional action error. If not empty
     * then all the props should be considered
     * unreliable.
     */
    error?:Error;

    isSideEffect?:boolean;
}

export const typedProps = <T>(props) => <T>props;

/**
 * In KonText, an action can be also an observable
 * stream (e.g. for asynchronous actions
 * [fetch data]...[apply data])).
 */
export type Action = ActionPayload|Rx.Observable<ActionPayload>;

export interface SEDispatcher {
    (seAction:ActionPayload):void;
}

/**
 *
 */
export interface IReducer<T> {

    reduce(state:T, action:ActionPayload):T;
    sideEffects(state:T, action:ActionPayload, dispatch:SEDispatcher):void;

}

/**
 * KonText ActionDispatcher is inspired by Flux
 * dispatcher in the sense that it is the only
 * entry through which all the application
 * actions are processed. It is based on Observable
 * streams.
 */
export class ActionDispatcher {

        /**
         * Incoming user actions - either action payload
         * (typical for simple sync actions) or an Observable
         * (typical for asynchronous actions).
         */
        private inStream$:Rx.Subject<Action>;

        /**
         * These are flattened user actions (i.e. even action streams
         * are here as individual actions).
         */
        private action$:Rx.Observable<ActionPayload>;

        constructor() {
            this.inStream$ = new Rx.Subject<Action>();
            this.action$ = this.inStream$.flatMap(v => {
                if (v instanceof Rx.Observable) {
                    return v;

                } else {
                    return Rx.Observable.from([v]);
                }
            }).share();
            this.dispatch = this.dispatch.bind(this);
        }

        register(callback:(payload:ActionPayload)=>void):Rx.Subscription {
            return this.action$.subscribe(callback);
        }

        /**
         * Dispatch an action. It can be either an
         * action object (for synchronous actions)
         * or an Rx.Observable (for asynchronous ones).
         */
        dispatch(action:Action):void {
            this.inStream$.next(action);
        }

        /**
         * Create a state Observable stream for a model with
         * defined initial state and optional side effect handler.
         *
         * @param sideEffects a function which reacts to different
         * actions (typically using a 'switch') and performs another
         * action (typically an async one).
         */
        createStateStream$<T>(model:IReducer<T>, initialState:T):Rx.BehaviorSubject<T> {
            const state$ = new Rx.BehaviorSubject(null);
            this.action$
                .startWith(null)
                .scan(
                    (state:T, action:ActionPayload) => {
                        const newState = action !== null ? model.reduce(state, action) : state;
                        action !== null ?
                            model.sideEffects(
                                newState,
                                action,
                                (seAction:Action) => {
                                    window.setTimeout(() => {
                                        if (seAction instanceof Rx.Observable) {
                                            // TODO
                                        } else {
                                            this.dispatch({
                                                isSideEffect: true,
                                                actionType: seAction.actionType,
                                                props: seAction.props,
                                                error: seAction.error
                                            });
                                        }
                                    }, 0);

                                }
                            ) :
                            null;
                        return newState;
                    },
                    initialState
                )
                .subscribe(state$);
            return state$;
        }

}