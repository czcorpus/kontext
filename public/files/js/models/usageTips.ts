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

import { StatelessModel, IActionDispatcher } from 'kombo';
import { tuple, List, pipe, Dict } from 'cnc-tskit';



export enum UsageTipCategory {
    QUERY = 'query',
    CONCORDANCE = 'conc'
}


interface UsageTip {
    messageId:string;
    category:UsageTipCategory;
}


const tipsDef = [
    {messageId: 'query__tip_01', category: UsageTipCategory.QUERY},
    {messageId: 'query__tip_02', category: UsageTipCategory.QUERY},
    {messageId: 'query__tip_03', category: UsageTipCategory.QUERY},
    {messageId: 'query__tip_04', category: UsageTipCategory.QUERY},
    {messageId: 'query__tip_05', category: UsageTipCategory.QUERY},
    {messageId: 'concview__tip_01', category: UsageTipCategory.CONCORDANCE},
    {messageId: 'concview__tip_02', category: UsageTipCategory.CONCORDANCE},
    {messageId: 'concview__tip_03', category: UsageTipCategory.CONCORDANCE},
    {messageId: 'concview__tip_04', category: UsageTipCategory.CONCORDANCE}
];

export interface UsageTipsState {
    currentHints:{[key in UsageTipCategory]:string};
    hintsPointers:{[key in UsageTipCategory]:number};
}


/**
 *
 */
export class UsageTipsModel extends StatelessModel<UsageTipsState> {

    private translatorFn:(s:string)=>string;

    constructor(dispatcher:IActionDispatcher, translatorFn:(s:string)=>string) {
        const pointers = pipe(
            [UsageTipCategory.CONCORDANCE, UsageTipCategory.QUERY],
            List.map(cat => {
                const avail = tipsDef.filter(v => v.category === cat);
                return tuple(cat, Math.round(Math.random() * (avail.length - 1)));
            }),
            Dict.fromEntries()
        );
        super(
            dispatcher,
            {
                hintsPointers: pointers,
                currentHints: pipe(
                    [UsageTipCategory.CONCORDANCE, UsageTipCategory.QUERY],
                    List.map(cat => {
                        const avail = tipsDef.filter(v => v.category === cat);
                        return tuple(
                            cat,
                            avail.length > 0 ? translatorFn(avail[pointers[cat]].messageId) : null
                        );
                    }),
                    Dict.fromEntries()
                )
            }
        );
        this.translatorFn = translatorFn;

        this.addActionHandler(
            'NEXT_QUERY_HINT',
            (state, action) => {
                this.setNextHint(state, UsageTipCategory.QUERY);
            }
        );

        this.addActionHandler(
            'NEXT_CONC_HINT',
            (state, action) => {
                this.setNextHint(state, UsageTipCategory.CONCORDANCE);
            }
        );
    }

    private setNextHint(state:UsageTipsState, category:UsageTipCategory):void {
        const curr = state.hintsPointers[category];
        const avail = tipsDef.filter(v => v.category === category);
        state.hintsPointers[category] = (curr + 1) % avail.length;
        state.currentHints[category] = this.translatorFn(
            avail[state.hintsPointers[category]].messageId);
    }

}