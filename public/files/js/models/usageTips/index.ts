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

import { Actions } from './actions';
import { Actions as QueryActions } from '../query/actions';
import { IUnregistrable } from '../common/common';
import { Actions as GlobalActions, ActionName as GlobalActionName } from '../common/actions';



export enum UsageTipCategory {
    QUERY = 'query',
    CQL_QUERY = 'cql-query',
    CONCORDANCE = 'conc'
}


const availableTips = [
    {messageId: 'query__tip_01', category: [UsageTipCategory.QUERY, UsageTipCategory.CQL_QUERY]},
    {messageId: 'query__tip_02', category: [UsageTipCategory.CQL_QUERY]},
    {messageId: 'query__tip_03', category: [UsageTipCategory.CQL_QUERY]},
    {messageId: 'query__tip_04', category: [UsageTipCategory.QUERY, UsageTipCategory.CQL_QUERY]},
    {messageId: 'query__tip_05', category: [UsageTipCategory.QUERY, UsageTipCategory.CQL_QUERY]},
    {messageId: 'query__tip_06', category: [UsageTipCategory.QUERY, UsageTipCategory.CQL_QUERY]},
    {messageId: 'query__tip_08', category: [UsageTipCategory.QUERY, UsageTipCategory.CQL_QUERY]},
    {messageId: 'concview__tip_01', category: [UsageTipCategory.CONCORDANCE]},
    {messageId: 'concview__tip_02', category: [UsageTipCategory.CONCORDANCE]},
    {messageId: 'concview__tip_03', category: [UsageTipCategory.CONCORDANCE]},
    {messageId: 'concview__tip_04', category: [UsageTipCategory.CONCORDANCE]}
];

export interface ForcedTip {
    message:string;
    priority:number;
}

export interface UsageTipsState {
    availableTips:Array<{messageId:string; category:UsageTipCategory[]}>;
    currentHints:{[key in UsageTipCategory]:string};
    hintsPointers:{[key in UsageTipCategory]:number};
    forcedTip:ForcedTip|null;
}


/**
 *
 */
export class UsageTipsModel extends StatelessModel<UsageTipsState> implements IUnregistrable {

    private translatorFn:(s:string)=>string;

    constructor(dispatcher:IActionDispatcher, translatorFn:(s:string)=>string) {
        const pointers = pipe(
            [UsageTipCategory.CONCORDANCE, UsageTipCategory.QUERY, UsageTipCategory.CQL_QUERY],
            List.map(cat => {
                const avail = availableTips.filter(v => v.category.includes(cat));
                return tuple(cat, Math.round(Math.random() * (avail.length - 1)));
            }),
            Dict.fromEntries()
        );
        super(
            dispatcher,
            {
                hintsPointers: pointers,
                currentHints: pipe(
                    [UsageTipCategory.CONCORDANCE, UsageTipCategory.QUERY, UsageTipCategory.CQL_QUERY],
                    List.map(cat => {
                        const avail = availableTips.filter(v => v.category.includes(cat));
                        return tuple(
                            cat,
                            avail.length > 0 ? translatorFn(avail[pointers[cat]].messageId) : null
                        );
                    }),
                    Dict.fromEntries()
                ),
                availableTips,
                forcedTip: null
            }
        );
        this.translatorFn = translatorFn;

        this.addActionHandler<typeof Actions.NextQueryHint>(
            Actions.NextQueryHint.name,
            (state, action) => {
                this.setNextHint(state, UsageTipCategory.QUERY);
            }
        );

        this.addActionHandler<typeof Actions.NextCqlQueryHint>(
            Actions.NextCqlQueryHint.name,
            (state, action) => {
                this.setNextHint(state, UsageTipCategory.CQL_QUERY);
            }
        );

        this.addActionHandler<typeof Actions.NextConcHint>(
            Actions.NextConcHint.name,
            (state, action) => {
                this.setNextHint(state, UsageTipCategory.CONCORDANCE);
            }
        );

        this.addActionHandler<GlobalActions.SwitchCorpus>(
            GlobalActionName.SwitchCorpus,
            (state, action) => {
                state.forcedTip = null;
            },
            (state, action, dispatch) => {
                dispatch<GlobalActions.SwitchCorpusReady<{}>>({
                    name: GlobalActionName.SwitchCorpusReady,
                    payload: {
                        modelId: this.getRegistrationId(),
                        data: {}
                    }
                });
            }
        );

        this.addActionHandler<typeof QueryActions.QueryInputSetQType>(
            QueryActions.QueryInputSetQType.name,
            (state, action) => {
                state.forcedTip = null;
            }
        );

        this.addActionHandler<typeof Actions.ForceHint>(
            Actions.ForceHint.name,
            (state, action) => {
                if (state.forcedTip === null || state.forcedTip.priority < action.payload.priority) {
                    state.forcedTip = action.payload;
                }
            }
        );
    }

    getRegistrationId():string {
        return 'usage-tips-model';
    }

    private setNextHint(state:UsageTipsState, category:UsageTipCategory):void {
        const curr = state.hintsPointers[category];
        const avail = state.availableTips.filter(v => v.category.includes(category));
        state.forcedTip = null;
        state.hintsPointers[category] = (curr + 1) % avail.length;
        state.currentHints[category] = this.translatorFn(
            avail[state.hintsPointers[category]].messageId);
    }

}