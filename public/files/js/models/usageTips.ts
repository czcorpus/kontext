/*
 * Copyright (c) 2018 Charles University, Faculty of Arts,
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

import * as Immutable from 'immutable';
import { StatelessModel } from './base';
import { ActionDispatcher, Action } from '../app/dispatcher';



export enum UsageTipCategory {
    QUERY = 'query',
    CONCORDANCE = 'conc'
}


interface UsageTip {
    messageId:string;
    category:UsageTipCategory;
}


const tipsDef = Immutable.List<UsageTip>([
    {messageId: 'query__tip_01', category: UsageTipCategory.QUERY},
    {messageId: 'query__tip_02', category: UsageTipCategory.QUERY},
    {messageId: 'query__tip_03', category: UsageTipCategory.QUERY},
    {messageId: 'query__tip_04', category: UsageTipCategory.QUERY},
    {messageId: 'query__tip_05', category: UsageTipCategory.QUERY},
    {messageId: 'concview__tip_01', category: UsageTipCategory.CONCORDANCE},
    {messageId: 'concview__tip_02', category: UsageTipCategory.CONCORDANCE},
    {messageId: 'concview__tip_03', category: UsageTipCategory.CONCORDANCE},
    {messageId: 'concview__tip_04', category: UsageTipCategory.CONCORDANCE}
]);

export interface UsageTipsState {
    currentHints:Immutable.Map<UsageTipCategory, string>;
    hintsPointers:Immutable.Map<UsageTipCategory, number>;
}


/**
 *
 */
export class UsageTipsModel extends StatelessModel<UsageTipsState> {

    private translatorFn:(s:string)=>string;

    constructor(dispatcher:ActionDispatcher, translatorFn:(s:string)=>string) {
        const pointers = Immutable.Map<UsageTipCategory, number>([
            UsageTipCategory.CONCORDANCE,
            UsageTipCategory.QUERY

        ].map(cat => {
            const avail = tipsDef.filter(v => v.category == cat);
            return [cat, Math.round(Math.random() * (avail.size - 1))|0];
        }));

        super(
            dispatcher,
            {
                hintsPointers: pointers,
                currentHints: Immutable.Map<UsageTipCategory, string>(
                    [
                        UsageTipCategory.CONCORDANCE,
                        UsageTipCategory.QUERY

                    ].map(cat => {
                        const avail = tipsDef.filter(v => v.category === cat);
                        return [
                            cat,
                            avail.size > 0 ? translatorFn(avail.get(pointers.get(cat)).messageId) : null
                        ];
                    })
                )
            }
        );
        this.translatorFn = translatorFn;
    }

    reduce(state:UsageTipsState, action:Action):UsageTipsState {
        let newState:UsageTipsState;
        switch (action.actionType) {
            case 'NEXT_QUERY_HINT':
                newState = this.copyState(state);
                this.setNextHint(newState, UsageTipCategory.QUERY);
                return newState;
            case 'NEXT_CONC_HINT':
                newState = this.copyState(state);
                this.setNextHint(newState, UsageTipCategory.CONCORDANCE);
                return newState;
            default:
                return state;
        }
    }

    setNextHint(state:UsageTipsState, category:UsageTipCategory):void {
        const curr = state.hintsPointers.get(category);
        const avail = tipsDef.filter(v => v.category === category);
        state.hintsPointers = state.hintsPointers.set(category, (curr + 1) % avail.size);
        state.currentHints = state.currentHints.set(category,
            this.translatorFn(avail.get(state.hintsPointers.get(category)).messageId));
    }

}