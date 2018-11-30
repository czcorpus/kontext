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
export interface Action<T extends Kontext.GeneralProps={}> {

    /**
     * Upper case action identifier
     */
    actionType:string;

    /**
     * Action's arguments. A defined, non-null
     * object should be always used.
     */
    props:T;

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
 * More generally (and internally), KonText works not just
 * with actions (= user actions) but also with streams of
 * actions which are used to resolve more complicated
 * operations (e.g. chains of promises with more involved
 * models). In the realm of the Dispatcher we call both
 * of these 'events'.
 */
export type Event = Action|Rx.Observable<Action>;

export interface SEDispatcher {
    (seAction:Action):void;
}

/**
 *
 */
export interface IReducer<T> {

    reduce(state:T, action:Action):T;
    sideEffects(state:T, action:Action, dispatch:SEDispatcher):void;

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
        private inStream$:Rx.Subject<Event>;

        /**
         * These are flattened user actions (i.e. even action streams
         * are here as individual actions).
         */
        private action$:Rx.Observable<Action>;

        constructor() {
            this.inStream$ = new Rx.Subject<Event>();
            this.action$ = this.inStream$.flatMap(v => {
                if (v instanceof Rx.Observable) {
                    return v;

                } else {
                    return Rx.Observable.from([v]);
                }
            }).share();
            this.dispatch = this.dispatch.bind(this);
        }

        register(callback:(action:Action)=>void):Rx.Subscription {
            return this.action$.subscribe(callback);
        }

        /**
         * Dispatch an action.
         */
        dispatch<T extends Action>(action:T):void {
            this.inStream$.next(action);
        }

        /**
         * Insert an observable stream as
         * a 'complex event'.
         */
        insert(obs:Rx.Observable<Action>) {
            this.inStream$.next(obs);
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
                    (state:T, action:Action) => {
                        const newState = action !== null ? model.reduce(state, action) : state;
                        action !== null ?
                            model.sideEffects(
                                newState,
                                action,
                                (seAction:Event) => {
                                    window.setTimeout(() => {
                                        if (seAction instanceof Rx.Observable) {
                                            this.insert(seAction.map(v => {
                                                return {
                                                    isSideEffect: true,
                                                    actionType: v.actionType,
                                                    props: v.props,
                                                    error: v.error
                                                }
                                            }));

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