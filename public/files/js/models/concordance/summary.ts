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
import { Actions, ActionName } from './actions';
import { ActionName as ConcActionName } from '../concordance/actions';
import { PageModel } from '../../app/page';
import { TextTypes } from '../../types/common';
import { Observable } from 'rxjs';
import { AjaxResponse } from '../../types/ajaxResponses';
import { HTTP } from 'cnc-tskit';
import { PluginInterfaces } from '../../types/plugins';


export interface ConcSummaryModelState {
    corpname:string;
    isBusy:boolean;
    providesAdHocIpm:boolean;
    fastAdHocIpm:boolean;
    corpusIpm:number; // ipm related to the whole corpus or a named subcorpus
    ipm:number|null;
    baseCorpusSize:number;
    concSize:number;
    fullSize:number; // TODO explain
    baseCorpname:string;
    subCorpName:string;
    origSubcorpName:string;
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

        this.addActionHandler<Actions.CalculateIpmForAdHocSubc>(
            ActionName.CalculateIpmForAdHocSubc,
            (state, action) => {
                state.isBusy = true;
            },

            (state, action, dispatch) => {
                this.suspend({}, (action, syncData) => {
                    return action.name === ActionName.CalculateIpmForAdHocSubcReady ?
                        null : syncData;

                }).pipe(
                    concatMap(
                        action => this.calculateAdHocIpm(
                            state,
                            (action as Actions.CalculateIpmForAdHocSubcReady).payload.ttSelection
                        )
                    )

                ).subscribe(
                    ipm => {
                        dispatch<Actions.CalculateIpmForAdHocSubcDone>({
                            name: ActionName.CalculateIpmForAdHocSubcDone,
                            payload: {
                                ipm
                            }
                        });
                    },
                    error => {
                        console.error(error);
                        this.layoutModel.showMessage(
                            'error',
                            this.layoutModel.translate('global__failed_to_calc_ipm')
                        );
                        dispatch<Actions.CalculateIpmForAdHocSubcDone>({
                            name: ActionName.CalculateIpmForAdHocSubcDone,
                            error
                        });
                    }
                );
            }
        );

        this.addActionHandler<Actions.CalculateIpmForAdHocSubcDone>(
            ActionName.CalculateIpmForAdHocSubcDone,
            (state, action) => {
                state.isBusy = false;
                state.ipm = action.payload.ipm;
            }
        );

        this.addActionHandler<Actions.AsyncCalculationUpdated>(
            ActionName.AsyncCalculationUpdated,
            (state, action) => {
                const prevConcSize = state.concSize;
                state.isUnfinishedConc = !action.payload.finished;
                state.concSize = action.payload.concsize;
                state.fullSize = action.payload.fullsize;
                state.corpusIpm = action.payload.relconcsize;
                state.arf = action.payload.arf;
            },
            (state, action, dispatch) => {
                dispatch<Actions.ConcordanceRecalculationReady>({
                    name: ActionName.ConcordanceRecalculationReady,
                    payload: {
                        concSize: action.payload.concsize,
                        overviewMinFreq: this.getRecommOverviewMinFreq(action.payload.concsize)
                    }
                })
            }
        ).sideEffectAlsoOn(
            ConcActionName.LoadTTDictOverview,
            PluginInterfaces.KwicConnect.Actions.FetchInfo
        );

        this.addActionHandler<Actions.AsyncCalculationFailed>(
            ActionName.AsyncCalculationFailed,
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

    private calculateAdHocIpm(state:ConcSummaryModelState, ttSelection:TextTypes.ExportedSelection):Observable<number> {
        return this.layoutModel.ajax$<AjaxResponse.WithinMaxHits>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl(
                'get_adhoc_subcorp_size'
            ),
            {
                corpname: state.baseCorpname,
                usesubcorp: state.subCorpName,
                ...this.layoutModel.getConcArgs(),
                type:'adHocIpmArgs',
                text_types: ttSelection
            },
            {
                contentType: 'application/json'
            }

        ).pipe(
            map(
                data => state.baseCorpusSize / data.total * 1e6
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