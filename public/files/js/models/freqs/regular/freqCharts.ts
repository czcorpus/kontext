/*
 * Copyright (c) 2022 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2022 Tomas Machalek <tomas.machalek@gmail.com>
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

import { Dict, List, pipe, tuple } from 'cnc-tskit';
import { IFullActionControl, SEDispatcher, StatelessModel } from 'kombo';
import { debounceTime, Observable, Subject } from 'rxjs';
import { PageModel } from '../../../app/page';
import { FreqResultResponse } from '../common';
import { Actions } from './actions';
import {
    BaseFreqModelState, FreqDataLoader, FreqServerArgs, PAGE_SIZE_INPUT_WRITE_THROTTLE_INTERVAL_MS,
    ResultBlock, validateNumber } from './common';
import { importData } from './table';
import { FreqFormInputs } from './freqForms';
import { StructuralAttribute } from 'public/files/js/types/kontext';

export type FreqChartsAvailableOrder = '0'|'freq'|'rel';
export type FreqChartsAvailableData = 'freq'|'rel';
export type FreqChartsAvailableTypes = 'bar'|'cloud'|'timeline';

export interface FreqChartsModelArgs {
    dispatcher:IFullActionControl;
    pageModel:PageModel;
    freqCrit:Array<string>;
    freqCritAsync:Array<string>;
    formProps:FreqFormInputs;
    initialData:Array<ResultBlock>;
    currentPage:number;
    fmaxitems:number;
    freqLoader:FreqDataLoader;
}

export interface FreqChartsModelState extends BaseFreqModelState {
    type:{[sourceId:string]:FreqChartsAvailableTypes};
    dataKey:{[sourceId:string]:FreqChartsAvailableData};
    fmaxitems:{[sourceId:string]:number};
    isBusy:{[sourceId:string]:boolean};
    dtFormat:{[sourceId:string]:string};
}

type DebouncedActions =
    typeof Actions.FreqChartsChangePageSize;

function getDtFormat(pageModel:PageModel, fcrit:string):string {    
    return List.find(
        v => v.name === fcrit.split('.')[1].split(' ')[0],
        pageModel.getNestedConf<Array<StructuralAttribute>>('structsAndAttrs', fcrit.split('.')[0])
    ).dtFormat;
}

export class FreqChartsModel extends StatelessModel<FreqChartsModelState> {


    private pageModel:PageModel;

    private freqLoader:FreqDataLoader;

    private readonly debouncedAction$:Subject<DebouncedActions>;

    constructor({
        dispatcher, pageModel, freqCrit, freqCritAsync, formProps,
        initialData, currentPage, fmaxitems, freqLoader
    }:FreqChartsModelArgs) {

        super(
            dispatcher,
            {
                data: pipe(
                    initialData,
                    // if initial data are time data we'll change chart parameters and reload on view init
                    List.map(v => tuple(v.fcrit, getDtFormat(pageModel, v.fcrit[0]) ? undefined : v)), // TODO v.fcrit is typed as string, but is list
                    List.concat(List.map(v => tuple(v, undefined), freqCritAsync)),
                    Dict.fromEntries()
                ),
                freqCrit,
                freqCritAsync,
                currentPage: pipe(
                    freqCrit,
                    List.concat(freqCritAsync),
                    List.map(
                        k => tuple(k, initialData.length > 1 ? null : `${currentPage}`)
                    ),
                    Dict.fromEntries()
                ),
                sortColumn: pipe(
                    freqCrit,
                    List.concat(freqCritAsync),
                    List.map(
                        k => tuple(k, formProps.freq_sort)
                    ),
                    Dict.fromEntries()
                ),
                ftt_include_empty: formProps.ftt_include_empty,
                flimit: formProps.flimit || '0',
                type: pipe(
                    freqCrit,
                    List.concat(freqCritAsync),
                    List.map(
                        k => tuple<string, FreqChartsAvailableTypes>(k, 'bar')
                    ),
                    Dict.fromEntries()
                ),
                dataKey: pipe(
                    freqCrit,
                    List.concat(freqCritAsync),
                    List.map(
                        k => tuple<string, FreqChartsAvailableData>(k, 'freq')
                    ),
                    Dict.fromEntries()
                ),
                fmaxitems: pipe(
                    freqCrit,
                    List.concat(freqCritAsync),
                    List.map(
                        k => tuple(k, fmaxitems)
                    ),
                    Dict.fromEntries()
                ),
                isBusy: pipe(
                    freqCrit,
                    List.concat(freqCritAsync),
                    List.map(
                        k => tuple(k, false)
                    ),
                    Dict.fromEntries()
                ),
                dtFormat: pipe(
                    freqCrit,
                    List.concat(freqCritAsync),
                    List.map(
                        k => tuple(k, getDtFormat(pageModel, k))
                    ),
                    Dict.fromEntries()
                )
            }
        );

        this.pageModel = pageModel;
        this.freqLoader = freqLoader;

        this.debouncedAction$ = new Subject();
        this.debouncedAction$.pipe(
            debounceTime(PAGE_SIZE_INPUT_WRITE_THROTTLE_INTERVAL_MS)

        ).subscribe({
            next: value => {
                dispatcher.dispatch({
                    ...value,
                    payload: {...value.payload, debounced: true}
                });
            }
        });

        this.addActionHandler<typeof Actions.FreqChartsDataLoaded>(
            Actions.FreqChartsDataLoaded.name,
            (state, action) => {
                state.isBusy[action.payload.data.fcrit] = false;
                if (action.error) {
                    this.pageModel.showMessage('error', action.error);

                } else {
                    state.data[action.payload.data.fcrit] = action.payload.data;
                }
            }
        );

        this.addActionHandler<typeof Actions.FreqChartsChangeOrder>(
            Actions.FreqChartsChangeOrder.name,
            (state, action) => {
                state.sortColumn[action.payload.sourceId] = action.payload.value;
                state.isBusy[action.payload.sourceId] = true;
            },
            (state, action, dispatch) => {
                this.dispatchLoad(
                    this.freqLoader.loadPage(this.getSubmitArgs(state, action.payload.sourceId)),
                    state,
                    dispatch,
                );
            }
        );

        this.addActionHandler<typeof Actions.FreqChartsChangeUnits>(
            Actions.FreqChartsChangeUnits.name,
            (state, action) => {
                state.dataKey[action.payload.sourceId] = action.payload.value;
            }
        );

        this.addActionHandler<typeof Actions.FreqChartsChangeType>(
            Actions.FreqChartsChangeType.name,
            (state, action) => {
                state.type[action.payload.sourceId] = action.payload.value;
                state.isBusy[action.payload.sourceId] = true;
            },
            (state, action, dispatch) => {
                this.dispatchLoad(
                    this.freqLoader.loadPage(this.getSubmitArgs(state, action.payload.sourceId)),
                    state,
                    dispatch,
                );
            }
        );

        this.addActionHandler<typeof Actions.FreqChartsChangePageSize>(
            Actions.FreqChartsChangePageSize.name,
            (state, action) => {
                if (action.payload.debounced) {
                    state.isBusy[action.payload.sourceId] = true;

                } else {
                    state.fmaxitems[action.payload.sourceId] = action.payload.value;
                    this.debouncedAction$.next(action);
                }

            },
            (state, action, dispatch) => {
                if (action.payload.debounced) {
                    this.dispatchLoad(
                        this.freqLoader.loadPage(
                            this.getSubmitArgs(state, action.payload.sourceId)
                        ),
                        state,
                        dispatch,
                    );
                }
            }
        );

        this.addActionHandler<typeof Actions.ResultApplyMinFreq>(
            Actions.ResultApplyMinFreq.name,
            (state, action) => {
                state.isBusy = Dict.map(_ => true, state.isBusy);
                state.currentPage = Dict.map(_ => '1', state.currentPage);
            },
            (state, action, dispatch) => {
                Dict.forEach(
                    (_, sourceId) => {
                        this.dispatchLoad(
                            this.freqLoader.loadPage(this.getSubmitArgs(state, sourceId)),
                            state,
                            dispatch,
                        );
                    },
                    state.data
                );
            }
        );

        this.addActionHandler<typeof Actions.FreqChartsReloadData>(
            Actions.FreqChartsReloadData.name,
            (state, action) => {
                state.isBusy[action.payload.sourceId] = true
            },
            (state, action, dispatch) => {
                this.dispatchLoad(
                    this.freqLoader.loadPage(this.getSubmitArgs(state, action.payload.sourceId)),
                    state,
                    dispatch,
                );
            }
        );

        this.addActionHandler<typeof Actions.ResultSetMinFreqVal>(
            Actions.ResultSetMinFreqVal.name,
            (state, action) => {
                if (validateNumber(action.payload.value, 0)) {
                    state.flimit = action.payload.value;
                }
            }
        );

        this.addActionHandler<typeof Actions.FreqChartsSetParameters>(
            Actions.FreqChartsSetParameters.name,
            (state, action) => {
                state.sortColumn[action.payload.sourceId] = action.payload.sortColumn;
                state.type[action.payload.sourceId] = action.payload.type;
                state.dataKey[action.payload.sourceId] = action.payload.dataKey;
                state.isBusy[action.payload.sourceId] = true;
            },
            (state, action, dispatch) => {
                this.dispatchLoad(
                    this.freqLoader.loadPage(this.getSubmitArgs(state, action.payload.sourceId)),
                    state,
                    dispatch,
                );
            }
        );
    }

    private dispatchLoad(
        load:Observable<FreqResultResponse>,
        state:FreqChartsModelState,
        dispatch:SEDispatcher
    ):void {

        load.subscribe({
            next: data => {
                List.forEach(
                    (block, idx) => {
                        dispatch<typeof Actions.FreqChartsDataLoaded>({
                            name: Actions.FreqChartsDataLoaded.name,
                            payload: {
                                data: importData(
                                    this.pageModel,
                                    block,
                                    parseInt(state.currentPage[block.fcrit]),
                                    data.fmaxitems
                                )
                            },
                        });
                    },
                    data.Blocks
                )
            },
            error: error => {
                dispatch<typeof Actions.FreqChartsDataLoaded>({
                    name: Actions.FreqChartsDataLoaded.name,
                    error
                });
            }
        });
    }

    getSubmitArgs(state:FreqChartsModelState, fcrit:string):FreqServerArgs {
        return {
            ...this.pageModel.getConcArgs(),
            fcrit,
            flimit: parseInt(state.flimit),
            freq_sort: state.type[fcrit] === 'timeline' ? '0' : state.sortColumn[fcrit],
            fpage: state.currentPage[fcrit],
            ftt_include_empty: state.ftt_include_empty,
            freqlevel: 1,
            fmaxitems: state.fmaxitems[fcrit],
            format: 'json'
        };
    }
}
