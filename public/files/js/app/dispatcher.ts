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

/// <reference path="../types/common.d.ts" />

import * as Rx from '@reactivex/rxjs';

type ActionType = Kontext.DispatcherPayload|Rx.Observable<Kontext.DispatcherPayload>;

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
        private inStream$:Rx.Subject<ActionType>;

        /**
         * These are flattened user actions (i.e. even action streams
         * are here as individual actions).
         */
        private action$:Rx.Observable<Kontext.DispatcherPayload>;

        constructor() {
            this.inStream$ = new Rx.Subject<ActionType>();
            this.action$ = this.inStream$.flatMap(v => {
                if (v instanceof Rx.Observable) {
                    return v;

                } else {
                    return Rx.Observable.from([v]);
                }
            }).share();
        }

        register(callback:(payload:Kontext.DispatcherPayload)=>void):Rx.Subscription {
            return this.action$.subscribe(callback);
        }

        /**
         * Dispatch an action. It can be either an
         * action object (for synchronous actions)
         * or an Rx.Observable (for asynchronous ones).
         */
        dispatch(action:ActionType):void {
            this.inStream$.next(action);
        }

        /**
         * Create a state Observable stream for a store with
         * defined initial state.
         */
        createStateStream$<T>(model:Kontext.IReducer<T>, initialState:T):Rx.BehaviorSubject<T> {
            const state$ = new Rx.BehaviorSubject(null);
            this.action$
                .scan(
                    (state:T, action:Kontext.DispatcherPayload) => action !== null  ? model.reduce(state, action) : state,
                    initialState
                )
                .subscribe(state$);
            return state$;
        }

}