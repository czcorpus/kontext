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

import { Dict, List, Maths, pipe, tuple } from 'cnc-tskit';
import { IFullActionControl, SEDispatcher, StatelessModel } from 'kombo';
import { debounceTime, Observable, Subject } from 'rxjs';
import { PageModel } from '../../../app/page';
import { FreqChartsAvailableData, FreqChartsAvailableTypes, FreqResultResponse } from '../common';
import { Actions } from './actions';
import {
    BaseFreqModelState, clearResultBlock, EmptyResultBlock, FreqDataLoader, FreqServerArgs,
    isEmptyResultBlock, PAGE_SIZE_INPUT_WRITE_THROTTLE_INTERVAL_MS, recalculateConfIntervals,
    ResultBlock, validateNumber
} from './common';
import { importData } from './table';
import { FreqFormInputs } from './freqForms';
import { StructuralAttribute, FormValue, newFormValue, AttrItem, ChartExportFormat, BasicFreqModuleType } from '../../../types/kontext';
import { validateGzNumber } from '../../base';



export interface FreqChartsModelArgs {
    freqType:BasicFreqModuleType;
    dispatcher:IFullActionControl;
    pageModel:PageModel;
    freqCrit:Array<AttrItem>;
    freqCritAsync:Array<AttrItem>;
    formProps:FreqFormInputs;
    initialData:Array<ResultBlock|EmptyResultBlock>|undefined;
    fmaxitems:number;
    freqLoader:FreqDataLoader;
}

export interface FreqChartsModelState extends BaseFreqModelState {
    type:{[sourceId:string]:FreqChartsAvailableTypes};
    dataKey:{[sourceId:string]:FreqChartsAvailableData};
    fmaxitems:{[sourceId:string]:FormValue<string>};
    dtFormat:{[sourceId:string]:string};
    downloadFormat:{[sourceId:string]:ChartExportFormat};
}


type DebouncedActions =
    typeof Actions.FreqChartsChangePageSize |  typeof Actions.ResultSetMinFreqVal;


function getDtFormat(pageModel:PageModel, fcrit:string):string {
    return List.find(
        // TODO maybe this fcrit parsing is too low-level (but the server must
        // reflect the issue too as there is no alternative value for this at the moment)
        v => v.name === fcrit.split('.')[1].split(' ')[0],
        pageModel.getNestedConf<Array<StructuralAttribute>>('structsAndAttrs', fcrit.split('.')[0])
    ).dtFormat;
}

/**
 * FreqChartsModel handles data operations and events for frequency distribution
 * in form of charts.
 */
export class FreqChartsModel extends StatelessModel<FreqChartsModelState> {

    private pageModel:PageModel;

    private freqLoader:FreqDataLoader;

    private readonly debouncedAction$:Subject<DebouncedActions>;


    constructor({
        dispatcher, pageModel, freqType, freqCrit, freqCritAsync, formProps,
        initialData, fmaxitems, freqLoader
    }:FreqChartsModelArgs) {
        const allCrits = List.concat(freqCritAsync, freqCrit);
        super(
            dispatcher,
            {
                freqType,
                data: pipe(
                    initialData,
                    // if initial data are time data we'll change chart parameters and reload on view init
                    List.map(
                        v => tuple(
                            v.fcrit,
                            getDtFormat(pageModel, v.fcrit) && !isEmptyResultBlock(v) ?
                                {
                                    fcrit: v.fcrit,
                                    heading: v.Head[0].n,
                                    TotalPages: 0,
                                    isEmpty: true
                                } as EmptyResultBlock :
                                v
                        )
                    ),
                    List.concat<[string, EmptyResultBlock|ResultBlock]>(
                        List.map(
                            v => tuple(
                                v.n,
                                {
                                    fcrit: v.n,
                                    heading: v.label,
                                    TotalPages: 0,
                                    isEmpty: true
                                }
                            ),
                            freqCritAsync
                        )
                    ),
                    Dict.fromEntries()
                ),
                freqCrit,
                freqCritAsync,
                sortColumn: pipe(
                    allCrits,
                    List.map(
                        k => tuple(k.n, formProps.freq_sort || 'freq')
                    ),
                    Dict.fromEntries()
                ),
                ftt_include_empty: formProps.ftt_include_empty,
                flimit: formProps.flimit || '0',
                type: pipe(
                    allCrits,
                    List.map(
                        k => tuple<string, FreqChartsAvailableTypes>(k.n, 'bar')
                    ),
                    Dict.fromEntries()
                ),
                currentPage: pipe(
                    allCrits,
                    List.map(
                        k => tuple(k.n, '1')
                    ),
                    Dict.fromEntries()
                ),
                dataKey: pipe(
                    allCrits,
                    List.map(
                        k => tuple<string, FreqChartsAvailableData>(k.n, 'rel')
                    ),
                    Dict.fromEntries()
                ),
                fmaxitems: pipe(
                    allCrits,
                    List.map(
                        k => tuple(k.n, newFormValue(fmaxitems + '', true))
                    ),
                    Dict.fromEntries()
                ),
                isBusy: pipe(
                    allCrits,
                    List.map(
                        k => tuple(k.n, false)
                    ),
                    Dict.fromEntries()
                ),
                isActive: false,
                dtFormat: pipe(
                    allCrits,
                    List.map(
                        k => tuple(k.n, getDtFormat(pageModel, k.n))
                    ),
                    Dict.fromEntries()
                ),
                alphaLevel: Maths.AlphaLevel.LEVEL_5,
                downloadFormat: pipe(
                    allCrits,
                    List.map(k => tuple<string, ChartExportFormat>(k.n, 'png')),
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
                    payload: {...value.payload, debouncedFor: 'charts'}
                });
            }
        });

        this.addActionHandler(
            Actions.ResultSetActiveTab,
            (state, action) => {
                state.isActive = action.payload.value === 'charts';
            }
        );

        this.addActionHandler(
            Actions.FreqChartsDataLoaded,
            (state, action) => {
                state.isBusy[action.payload.data.fcrit] = false;
                if (action.error) {
                    this.pageModel.showMessage('error', action.error);

                } else {
                    state.data[action.payload.data.fcrit] = action.payload.data;
                }
            }
        );

        this.addActionHandler(
            Actions.FreqChartsChangeOrder,
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

        this.addActionHandler(
            Actions.FreqChartsChangeUnits,
            (state, action) => {
                state.dataKey[action.payload.sourceId] = action.payload.value;
            }
        );

        this.addActionHandler(
            Actions.FreqChartsChangeType,
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

        this.addActionHandler(
            Actions.FreqChartsChangePageSize,
            (state, action) => {
                if (action.payload.debouncedFor) {
                    state.isBusy[action.payload.sourceId] = true;

                } else {
                    state.fmaxitems[action.payload.sourceId].value = action.payload.value;
                    if (validateGzNumber(state.fmaxitems[action.payload.sourceId].value)) {
                        state.fmaxitems[action.payload.sourceId].isInvalid = false;
                        state.fmaxitems[action.payload.sourceId].errorDesc = undefined;
                        this.debouncedAction$.next(action);

                    } else {
                        state.fmaxitems[action.payload.sourceId].isInvalid = true;
                        state.fmaxitems[action.payload.sourceId].errorDesc = this.pageModel.translate('options__value_must_be_gt_0');
                    }
                }

            },
            (state, action, dispatch) => {
                if (validateGzNumber(state.fmaxitems[action.payload.sourceId].value)) {
                    if (action.payload.debouncedFor) {
                        this.dispatchLoad(
                            this.freqLoader.loadPage(
                                this.getSubmitArgs(state, action.payload.sourceId)
                            ),
                            state,
                            dispatch,
                        );
                    }

                } else {
                    this.pageModel.showMessage('error', this.pageModel.translate('options__value_must_be_gt_0'));
                }
            }
        );

        this.addActionHandler(
            Actions.FreqChartsReloadData,
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

        this.addActionHandler(
            Actions.ResultSetMinFreqVal,
            (state, action) => {
                if (action.payload.debouncedFor) {
                    if (validateNumber(action.payload.value, 0)) {
                        state.isBusy = Dict.map(v => true, state.isBusy);
                        if (!state.isActive) {
                            state.data = Dict.map(v => clearResultBlock(v), state.data);
                        }
                    }

                } else {
                    state.flimit = action.payload.value;
                    this.debouncedAction$.next(action);
                }

            },
            (state, action, dispatch) => {
                if (action.payload.debouncedFor === 'charts') {
                    if (validateNumber(action.payload.value, 0)) {
                        if (state.isActive) {
                            Dict.forEach(
                                (block, fcrit) => {
                                    this.dispatchLoad(
                                        this.freqLoader.loadPage(this.getSubmitArgs(state, fcrit)),
                                        state,
                                        dispatch
                                    );
                                },
                                state.data
                            );
                        }

                    } else {
                        this.pageModel.showMessage(
                            'error', this.pageModel.translate('freq__limit_invalid_val'));
                    }
                }
            }
        );

        this.addActionHandler(
            Actions.FreqChartsSetParameters,
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

        this.addActionHandler(
            Actions.ResultSetAlphaLevel,
            (state, action) => {
                state.alphaLevel = action.payload.value;
                state.data = Dict.map(
                    block => {
                        if (isEmptyResultBlock(block)) {
                            return block;
                        }
                        return recalculateConfIntervals(block, state.alphaLevel);
                    },
                    state.data
                )
            }
        );

        this.addActionHandler(
            Actions.FreqChartsSetDownloadFormat,
            (state, action) => {
                state.downloadFormat[action.payload.sourceId] = action.payload.format;
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
                                    1,
                                    data.fmaxitems,
                                    state.alphaLevel
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
            freq_sort: state.type[fcrit] === 'timeline' || state.type[fcrit] === 'timescatter' ?
                '0' :
                state.sortColumn[fcrit],
            fpage: 1,
            ftt_include_empty: state.ftt_include_empty,
            freqlevel: 1,
            fmaxitems: parseInt(state.fmaxitems[fcrit].value),
            format: 'json'
        };
    }
}
