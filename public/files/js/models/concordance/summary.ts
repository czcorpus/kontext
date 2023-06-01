/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
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

import { IActionDispatcher, StatelessModel } from 'kombo';
import { concatMap, map } from 'rxjs/operators';
import { Actions } from './actions';
import { PageModel } from '../../app/page';
import * as Kontext from '../../types/kontext';
import * as TextTypes from '../../types/textTypes';
import { Observable } from 'rxjs';
import { HTTP, List } from 'cnc-tskit';
import * as PluginInterfaces from '../../types/plugins';


export interface WithinMaxHits extends Kontext.AjaxResponse {
    total:number;
}


export interface ConcSummaryModelState {
    corpname:string;
    isBusy:boolean;
    providesAdHocIpm:boolean;
    fastAdHocIpm:boolean;
    corpusIpm:number; // ipm related to the whole corpus or a named subcorpus
    ipm:number|null;
    baseCorpusSize:number;
    cutoff:number;
    queryChainSize:number;
    concSize:number;
    fullSize:number; // TODO explain
    baseCorpname:string;
    subcId:string;
    subcName:string;
    isShuffled:boolean;
    isUnfinishedConc:boolean;
    arf:number;
}

export class ConcSummaryModel extends StatelessModel<ConcSummaryModelState> {

    private readonly layoutModel:PageModel;

    constructor(
        layoutModel:PageModel,
        dispatcher:IActionDispatcher,
        initialState:ConcSummaryModelState
    ) {
        super(dispatcher, initialState);
        this.layoutModel = layoutModel;

        this.addActionHandler(
            Actions.CalculateIpmForAdHocSubc,
            (state, action) => {
                state.isBusy = true;
            },

            (state, action, dispatch) => {
                this.waitForAction({}, (action, syncData) => {
                    return action.name === Actions.CalculateIpmForAdHocSubcReady.name ?
                        null : syncData;

                }).pipe(
                    concatMap(
                        action => this.calculateAdHocIpm(
                            state,
                            (action as typeof Actions.CalculateIpmForAdHocSubcReady).payload.ttSelection
                        )
                    )

                ).subscribe({
                    next: ipm => {
                        dispatch<typeof Actions.CalculateIpmForAdHocSubcDone>({
                            name: Actions.CalculateIpmForAdHocSubcDone.name,
                            payload: {
                                ipm
                            }
                        });
                    },
                    error: error => {
                        console.error(error);
                        this.layoutModel.showMessage(
                            'error',
                            this.layoutModel.translate('global__failed_to_calc_ipm')
                        );
                        dispatch<typeof Actions.CalculateIpmForAdHocSubcDone>({
                            name: Actions.CalculateIpmForAdHocSubcDone.name,
                            error
                        });
                    }
                });
            }
        );

        this.addActionHandler(
            Actions.ReloadConc,
            (state, action) => {
                state.arf = action.payload.arf;
                state.concSize = action.payload.concSize;
                state.fullSize = action.payload.fullSize;
                state.ipm = null;
                state.queryChainSize = action.payload.queryChainSize;
                state.corpusIpm = action.payload.corpusIpm;
            }
        )

        this.addActionHandler(
            Actions.AddedNewOperation,
            (state, action) => {
                state.arf = action.payload.data.result_arf;
                state.concSize = action.payload.data.concsize;
                state.fullSize = action.payload.data.fullsize;
                state.ipm = null;
                state.queryChainSize = List.size(action.payload.data.query_overview);
                state.corpusIpm = action.payload.data.result_relative_freq;
            },
            (state, action, dispatch) => {
                const concSize = action.payload.data.concsize;
                dispatch(
                    Actions.ConcordanceRecalculationReady,
                    {
                        concSize,
                        overviewMinFreq: this.getRecommOverviewMinFreq(concSize)
                    }
                );
            }
        );

        this.addActionHandler(
            Actions.CalculateIpmForAdHocSubcDone,
            (state, action) => {
                state.isBusy = false;
                state.ipm = action.payload.ipm;
            }
        );

        this.addActionHandler(
            Actions.AsyncCalculationUpdated,
            (state, action) => {
                state.isUnfinishedConc = !action.payload.finished;
                state.concSize = action.payload.concsize;
                state.fullSize = action.payload.fullsize;
                state.corpusIpm = action.payload.relconcsize;
                state.arf = action.payload.arf;
                state.queryChainSize = 1; // the action can happen iff processing the first operation
            },
            (state, action, dispatch) => {
                const concSize = action.payload?.concsize ?
                    action.payload.concsize :
                    state.concSize;
                dispatch(
                    Actions.ConcordanceRecalculationReady,
                    {
                        concSize,
                        overviewMinFreq: this.getRecommOverviewMinFreq(concSize)
                    }
                );
            }
        ).sideEffectAlsoOn(
            Actions.LoadTTDictOverview.name,
            PluginInterfaces.KwicConnect.Actions.FetchInfo.name,
        );

        this.addActionHandler(
            Actions.AsyncCalculationFailed,
            (state, action) => {
                    state.isUnfinishedConc = false;
                    state.concSize = 0;
                    state.fullSize = 0;
                    state.corpusIpm = 0;
                    state.ipm = 0;
                    state.arf = 0;
            }
        );
    }

    private calculateAdHocIpm(
        state:ConcSummaryModelState,
        ttSelection:TextTypes.ExportedSelection
    ):Observable<number> {
        return this.layoutModel.ajax$<WithinMaxHits>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl(
                'get_adhoc_subcorp_size'
            ),
            {
                corpname: state.baseCorpname,
                usesubcorp: state.subcId,
                ...this.layoutModel.getConcArgs(),
                align: this.layoutModel.getConf<Array<string>>('alignedCorpora'),
                type:'adHocIpmArgs',
                text_types: ttSelection
            },
            {
                contentType: 'application/json'
            }

        ).pipe(
            map(
                data => state.concSize / data.total * 1e6
            )
        );
    }

    // TODO pick a good heuristics here
    private getRecommOverviewMinFreq(concSize:number):number {
        if (concSize > 10000) {
            return 100;

        } else if (concSize > 1000) {
            return 10;
        }
        return 1;
    }

}