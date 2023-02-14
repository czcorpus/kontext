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
import { Actions as MainMenuActions } from '../../mainMenu/actions';
import {
    EmptyResultBlock, FreqChartsModelState, FreqDataLoader, FreqServerArgs,
    isEmptyResultBlock, isFreqChartsModelState, PAGE_SIZE_INPUT_WRITE_THROTTLE_INTERVAL_MS,
    recalculateConfIntervals, ResultBlock
} from './common';
import { importData } from './table';
import { FreqFormInputs } from './freqForms';
import {
    StructuralAttribute, newFormValue, AttrItem, ChartExportFormat,
    BasicFreqModuleType
} from '../../../types/kontext';
import { validateGzNumber } from '../../base';
import * as copy from 'copy-to-clipboard';



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
    forcedParams:{[sourceId:string]:{[key:string]:any}};
    alphaLevel:Maths.AlphaLevel;
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
        initialData, fmaxitems, freqLoader, forcedParams, alphaLevel
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
                        k => tuple(k.n, forcedParams[k.n]?.freq_sort || formProps.freq_sort || 'freq')
                    ),
                    Dict.fromEntries()
                ),
                ftt_include_empty: formProps.ftt_include_empty,
                type: pipe(
                    allCrits,
                    List.map(
                        k => tuple<string, FreqChartsAvailableTypes>(k.n, forcedParams[k.n]?.type || 'bar')
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
                        k => tuple<string, FreqChartsAvailableData>(k.n, forcedParams[k.n]?.data_key || 'rel')
                    ),
                    Dict.fromEntries()
                ),
                fmaxitems: pipe(
                    allCrits,
                    List.map(
                        k => tuple(k.n, newFormValue((forcedParams[k.n]?.fmaxitems || fmaxitems) + '', true))
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
                isError: pipe(
                    allCrits,
                    List.map(
                        k => tuple(k.n, null)
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
                alphaLevel: alphaLevel,
                downloadFormat: pipe(
                    allCrits,
                    List.map(k => tuple<string, ChartExportFormat>(k.n, 'png')),
                    Dict.fromEntries()
                ),
                saveFormActive: false,
                shareLink: null,
                flimit: parseInt(formProps.flimit) || 0
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
            },
            (state, action, dispatch) => {
                if (state.isActive) {
                    this.pushStateToHistory(state);
                }
            }
        );

        this.addActionHandler(
            Actions.ResultShowShareLink,
            (state, action) => {
                state.shareLink = {
                    sourceId: action.payload.sourceId,
                    url: this.getShareLink(state, action.payload.sourceId)
                };
            }
        );

        this.addActionHandler(
            Actions.ResultHideShareLink,
            (state, action) => {
                state.shareLink = null;
            }
        );

        this.addActionHandler(
            Actions.ResultLinkCopyToClipboard,
            (state, action) => {
                if (state.isActive) {
                    copy(this.getShareLink(state, action.payload.sourceId));
                    this.pageModel.showMessage('info', this.pageModel.translate('global__link_copied_to_clipboard'));
                }
            }
        );

        this.addActionHandler(
            Actions.FreqChartsDataLoaded,
            (state, action) => {
                state.isBusy[action.payload.sourceId] = false;
                if (action.error) {
                    this.pageModel.showMessage('error', action.error);
                    state.isError[action.payload.sourceId] = action.error;

                } else {
                    state.data[action.payload.data.fcrit] = action.payload.data;
                }
            }
        );

        this.addActionSubtypeHandler(
            Actions.StatePushToHistory,
            action => action.payload.origin === 'charts',
            (state, action) => {
                this.pushStateToHistory(state);
            }
        );

        this.addActionHandler(
            Actions.PopHistory,
            (state, action) => {
                const storedState = action.payload.state;
                if (isFreqChartsModelState(storedState)) {
                    state.freqType = storedState.freqType;
                    state.data = storedState.data;
                    state.currentPage = storedState.currentPage;
                    state.sortColumn = storedState.sortColumn;
                    state.freqCrit = storedState.freqCrit;
                    state.freqCritAsync = storedState.freqCritAsync;
                    state.ftt_include_empty = storedState.ftt_include_empty;
                    state.isActive = storedState.isActive;
                    state.isBusy = storedState.isBusy;
                    state.isError = storedState.isError;
                    state.alphaLevel = storedState.alphaLevel;
                    state.saveFormActive = storedState.saveFormActive;
                    state.shareLink = storedState.shareLink;
                    state.type = storedState.type;
                    state.dataKey = storedState.dataKey;
                    state.fmaxitems = storedState.fmaxitems;
                    state.dtFormat = storedState.dtFormat;
                    state.downloadFormat = storedState.downloadFormat;
                }
            },
            (state, action, dispatch) => {
                if (action.payload.activeView === 'charts') {
                    Dict.forEach(
                        (_, fcrit) => {
                            this.dispatchLoad(
                                this.freqLoader.loadPage(
                                    this.getSubmitArgs(state, fcrit, state.flimit)),
                                state,
                                dispatch,
                                false,
                                fcrit,
                            );
                        },
                        state.currentPage
                    );
                }
            }
        );

        this.addActionHandler(
            Actions.FreqChartsChangeOrder,
            (state, action) => {
                state.sortColumn[action.payload.sourceId] = action.payload.value;
                state.isBusy[action.payload.sourceId] = true;
                state.isError[action.payload.sourceId] = null;
            },
            (state, action, dispatch) => {
                this.dispatchLoad(
                    this.freqLoader.loadPage(
                        this.getSubmitArgs(state, action.payload.sourceId, state.flimit)),
                    state,
                    dispatch,
                    true,
                    action.payload.sourceId,
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
                state.isError[action.payload.sourceId] = null;
            },
            (state, action, dispatch) => {
                this.dispatchLoad(
                    this.freqLoader.loadPage(
                        this.getSubmitArgs(state, action.payload.sourceId, state.flimit)),
                    state,
                    dispatch,
                    true,
                    action.payload.sourceId,
                );
            }
        );

        this.addActionHandler(
            Actions.FreqChartsChangePageSize,
            (state, action) => {
                if (action.payload.debouncedFor) {
                    state.isBusy[action.payload.sourceId] = true;
                    state.isError[action.payload.sourceId] = null;

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
                                this.getSubmitArgs(state, action.payload.sourceId, state.flimit)
                            ),
                            state,
                            dispatch,
                            true,
                            action.payload.sourceId,
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
                state.isError[action.payload.sourceId] = null;
            },
            (state, action, dispatch) => {
                this.dispatchLoad(
                    this.freqLoader.loadPage(
                        this.getSubmitArgs(state, action.payload.sourceId, state.flimit)),
                    state,
                    dispatch,
                    false,
                    action.payload.sourceId,
                );
            }
        );

        this.addActionHandler(
            Actions.ResultSetMinFreqValConfirm,
            (state, action) => {
                state.flimit = action.payload.value;
            }
        );

        this.addActionHandler(
            Actions.ResultSetMinFreqVal,
            null,
            (state, action, dispatch) => {
                this.suspendWithTimeout(
                    5000,
                    {},
                    (action, syncData) => {
                        if (Actions.isResultSetMinFreqValConfirm(action)) {
                            return null;
                        }
                        return syncData;
                    }
                ).subscribe(
                    action => {
                        if (state.isActive && Actions.isResultSetMinFreqValConfirm(action)) {
                            Dict.forEach(
                                (block, fcrit) => {
                                    this.dispatchLoad(
                                        this.freqLoader.loadPage(
                                            this.getSubmitArgs(state, fcrit, action.payload.value)),
                                        state,
                                        dispatch,
                                        true,
                                        fcrit,
                                    );
                                },
                                state.data
                            );
                        }
                    }
                );
            }
        );

        this.addActionHandler(
            Actions.FreqChartsSetParameters,
            (state, action) => {
                state.sortColumn[action.payload.sourceId] = action.payload.sortColumn;
                state.type[action.payload.sourceId] = action.payload.type;
                state.dataKey[action.payload.sourceId] = action.payload.dataKey;
                state.isBusy[action.payload.sourceId] = true;
                state.isError[action.payload.sourceId] = null;
            },
            (state, action, dispatch) => {
                this.dispatchLoad(
                    this.freqLoader.loadPage(
                        this.getSubmitArgs(state, action.payload.sourceId, state.flimit)),
                    state,
                    dispatch,
                    true,
                    action.payload.sourceId,
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

        this.addActionHandler(
            MainMenuActions.ShowSaveForm,
            (state, action) => {state.saveFormActive = true}
        );

        this.addActionHandler(
            Actions.ResultCloseSaveForm,
            (state, action) => {
                state.saveFormActive = false;
            }
        );
    }

    private pushStateToHistory(state:FreqChartsModelState):void {
        const firstCrit = List.head(state.freqCrit);
        const args = {
            ...this.getSubmitArgs(state, firstCrit.n, state.flimit),
            fcrit_async: List.map(v => v.n, state.freqCritAsync),
            fdefault_view: 'charts',
            freq_type: state.freqType,
            format: undefined
        };
        this.pageModel.getHistory().pushState(
            'freqs',
            args,
            {
                onPopStateAction: {
                    name: Actions.PopHistory.name,
                    payload: {
                        activeView: 'charts',
                        state: JSON.parse(JSON.stringify(state))
                    }
                }
            },
            window.document.title
        );
    }

    private dispatchLoad(
        load:Observable<FreqResultResponse>,
        state:FreqChartsModelState,
        dispatch:SEDispatcher,
        pushHistory:boolean,
        sourceId:string,
    ):void {
        load.subscribe({
            next: data => {
                List.forEach(
                    (block, idx) => {
                        dispatch(
                            Actions.FreqChartsDataLoaded,
                            {
                                data: importData(
                                    this.pageModel,
                                    block,
                                    1,
                                    data.fmaxitems,
                                    state.alphaLevel
                                ),
                                sourceId,
                            },
                        );
                    },
                    data.Blocks
                );
                if (pushHistory) {
                    dispatch<typeof Actions.StatePushToHistory>({
                        name: Actions.StatePushToHistory.name,
                        payload: {
                            origin: 'charts'
                        }
                    });
                }
            },
            error: error => {
                dispatch(
                    Actions.FreqChartsDataLoaded,
                    {data: undefined, sourceId},
                    error,
                );
            }
        });
    }

    private getShareLink(state:FreqChartsModelState, sourceId:string) {
        return this.pageModel.createActionUrl(
            'shared_freqs',
            {
                q: this.pageModel.getConcArgs().q,

                fcrit: state.data[sourceId].fcrit,
                freq_type: state.freqType,
                ftt_include_empty: state.ftt_include_empty,
                freqlevel: 1,

                flimit: state.flimit,
                alpha_level: state.alphaLevel,

                fmaxitems: parseInt(state.fmaxitems[sourceId].value),
                chart_type: state.type[sourceId],
                data_key: state.dataKey[sourceId],
                freq_sort: state.sortColumn[sourceId],

                fdefault_view: 'charts',
            }
        )
    }

    getSubmitArgs(state:FreqChartsModelState, fcrit:string, flimit:number):FreqServerArgs {
        return {
            ...this.pageModel.getConcArgs(),
            fcrit,
            flimit,
            freq_type: state.freqType,
            freq_sort: state.type[fcrit] === 'timeline' || state.type[fcrit] === 'timescatter' ?
                '0' :
                state.sortColumn[fcrit],
            fpage: 1,
            ftt_include_empty: state.ftt_include_empty,
            freqlevel: 1,
            fmaxitems: parseInt(state.fmaxitems[fcrit].value),
            format: 'json',
        };
    }
}
