/*
 * Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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

import { PageModel } from '../../../app/page';
import { FreqFormInputs } from './freqForms';
import { FreqResultsSaveModel } from '../save';
import { IFullActionControl, SEDispatcher, StatelessModel } from 'kombo';
import { debounceTime, Observable, Subject } from 'rxjs';
import {
    BaseFreqModelState, FreqDataLoader, FreqServerArgs, PAGE_SIZE_INPUT_WRITE_THROTTLE_INTERVAL_MS,
    ResultBlock, validateNumber } from './common';
import { Dict, List, pipe, tuple } from 'cnc-tskit';
import { ConcQuickFilterServerArgs } from '../../concordance/common';
import { Actions } from './actions';
import { Actions as MainMenuActions } from '../../mainMenu/actions';
import { TagsetInfo } from '../../../types/plugins/tagHelper';
import { Block, FreqResultResponse } from '../common';


export interface FreqDataRowsModelArgs {
    dispatcher:IFullActionControl;
    pageModel:PageModel;
    freqCrit:Array<string>;
    freqCritAsync:Array<string>;
    formProps:FreqFormInputs;
    quickSaveRowLimit:number;
    saveLinkFn:(file:string, url:string)=>void;
    initialData:Array<ResultBlock>;
    currentPage:number;
    freqLoader:FreqDataLoader;
}

export interface FreqDataRowsModelState extends BaseFreqModelState {
    saveFormActive:boolean;
}

function getPositionalTagAttrs(pageModel:PageModel): Array<string> {
    return List.reduce(
        (acc, curr) => {
            if (curr.type === 'positional') {
                return [...acc, curr.featAttr];
            }
            return acc
        },
        [],
        pageModel.getNestedConf<Array<TagsetInfo>>('pluginData', 'taghelper', 'corp_tagsets') || []
    );
}

export function importData(
    pageModel:PageModel,
    data:Block,
    currentPage:number,
    pageSize:number,
):ResultBlock {
    const posTagAttrs = getPositionalTagAttrs(pageModel);
    return {
        Items: List.map(
            (item, i) => ({
                idx: i + (currentPage - 1) * pageSize,
                Word: List.map(x => x.n, item.Word),
                pfilter: createQuickFilterUrl(pageModel, item.pfilter),
                nfilter: createQuickFilterUrl(pageModel, item.nfilter),
                fbar: item.fbar,
                freqbar: item.freqbar,
                rel: item.rel,
                relbar: item.relbar,
                freq: item.freq,
                nbar: item.nbar,
                norm: item.norm,
                norel: item.norel
            }),
            data.Items
        ),
        Head: List.map(
            item => ({
                ...item,
                isPosTag: List.some(v => v === item.n, posTagAttrs)
            }),
            data.Head
        ),
        TotalPages: data.TotalPages,
        Total: data.Total,
        SkippedEmpty: data.SkippedEmpty,
        fcrit: data.fcrit
    };
}

function createQuickFilterUrl(pageModel:PageModel, args:ConcQuickFilterServerArgs):string {
    if (args) {
        const submitArgs = {
            ...pageModel.getConcArgs(),
            ...args
        };
        return pageModel.createActionUrl('quick_filter', submitArgs);

    } else {
        return null;
    }
}

type DebouncedActions =
    typeof Actions.ResultSetCurrentPage;


export class FreqDataRowsModel extends StatelessModel<FreqDataRowsModelState> {

    private pageModel:PageModel;

    private saveModel:FreqResultsSaveModel;

    private freqLoader:FreqDataLoader;

    private readonly debouncedAction$:Subject<DebouncedActions>;

    constructor({
        dispatcher, pageModel, freqCrit, freqCritAsync, formProps, saveLinkFn,
        quickSaveRowLimit, initialData, currentPage, freqLoader
    }:FreqDataRowsModelArgs) {
        super(
            dispatcher,
            {
                data: pipe(
                    initialData,
                    List.map(v => tuple(v.fcrit, v)),
                    List.concat(List.map(v => tuple(v, undefined), freqCritAsync)),
                    Dict.fromEntries()
                ),
                freqCrit,
                freqCritAsync,
                currentPage: pipe(
                    freqCrit,
                    List.concat(freqCritAsync),
                    List.map(
                        (k, i) => tuple(k, i === 0 ? `${currentPage}` : `1`)
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
                isBusy: pipe(
                    freqCrit,
                    List.concat(freqCritAsync),
                    List.map(
                        k => tuple(k, false)
                    ),
                    Dict.fromEntries()
                ),
                saveFormActive: false
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

        this.saveModel = new FreqResultsSaveModel({
            dispatcher,
            layoutModel: pageModel,
            saveLinkFn,
            quickSaveRowLimit
        });

        this.addActionHandler>(
            MainMenuActions.ShowSaveForm,
            (state, action) => {state.saveFormActive = true}
        );

        this.addActionHandler(
            Actions.ResultCloseSaveForm,
            (state, action) => {
                state.saveFormActive = false;
            }
        );

        this.addActionHandler(
            Actions.ResultSetMinFreqVal,
            (state, action) => {
                if (validateNumber(action.payload.value, 0)) {
                    state.flimit = action.payload.value;

                } else {
                    this.pageModel.showMessage('error', this.pageModel.translate('freq__limit_invalid_val'));
                }
            }
        );

        this.addActionHandler(
            Actions.ResultApplyMinFreq,
            (state, action) => {
                state.isBusy = Dict.map(
                    v => true,
                    state.isBusy
                );
                state.currentPage = Dict.map(_ => '1', state.currentPage);
            },
            (state, action, dispatch) => {
                Dict.forEach(
                    (block, fcrit) => {
                        this.dispatchLoad(
                            this.freqLoader.loadPage(this.getSubmitArgs(state, fcrit)),
                            state,
                            dispatch,
                            true
                        );
                    },
                    state.data
                )
            }
        );

        this.addActionHandler(
            Actions.ReloadData,
            (state, action) => {
                state.isBusy[action.payload.sourceId] = true;
            },
            (state, action, dispatch) => {
                this.dispatchLoad(
                    this.freqLoader.loadPage(this.getSubmitArgs(state, action.payload.sourceId)),
                    state,
                    dispatch,
                    false
                );
            }
        );

        this.addActionHandler(
            Actions.ResultDataLoaded,
            (state, action) => {
                state.isBusy[action.payload.block.fcrit] = false;
                if (action.error) {
                    this.pageModel.showMessage('error', action.error);

                } else {
                    state.data = {
                        ...state.data,
                        [action.payload.block.fcrit]: action.payload.block
                    }
                }
            }
        );

        this.addActionHandler(
            Actions.StatePushToHistory,
            (state, action) => {
                this.pushStateToHistory(state);
            }
        );

        this.addActionHandler(
            Actions.PopHistory,
            (state, action) => {
                state.currentPage = action.payload.currentPage;
                state.flimit = action.payload.flimit;
                state.sortColumn = action.payload.sortColumn;
            },
            (state, action, dispatch) => {
                Dict.forEach(
                    (_, fcrit) => {
                        this.dispatchLoad(
                            this.freqLoader.loadPage(this.getSubmitArgs(state, fcrit)),
                            state,
                            dispatch,
                            false
                        );
                    },
                    state.currentPage
                )
            }
        );

        this.addActionHandler(
            Actions.ResultSortByColumn,
            (state, action) => {
                state.isBusy[action.payload.sourceId] = true;
                state.sortColumn[action.payload.sourceId] = action.payload.value;
            },
            (state, action, dispatch) => {
                this.dispatchLoad(
                    this.freqLoader.loadPage(this.getSubmitArgs(state, action.payload.sourceId)),
                    state,
                    dispatch,
                    true
                );
            }
        );

        this.addActionHandler(
            Actions.ResultSetCurrentPage,
            (state, action) => {
                state.currentPage[action.payload.sourceId] = action.payload.value;
                if (action.payload.debounced) {
                    if (validateNumber(action.payload.value, 1)) {
                        state.isBusy[action.payload.sourceId] = true;
                    }

                } else {
                    this.debouncedAction$.next(action);
                }
            },
            (state, action, dispatch) => {
                if (action.payload.debounced) {
                    if (validateNumber(action.payload.value, 1)) {
                        this.dispatchLoad(
                            this.freqLoader.loadPage(this.getSubmitArgs(state, action.payload.sourceId)),
                            state,
                            dispatch,
                            true
                        );

                    } else {
                        this.pageModel.showMessage(
                            'error', this.pageModel.translate('freq__page_invalid_val'));
                    }
                }
            }
        );

        this.addActionHandler(
            Actions.SaveFormSubmit,
            null,
            (state, action, dispatch) => {
                dispatch<typeof Actions.ResultPrepareSubmitArgsDone>({
                    name: Actions.ResultPrepareSubmitArgsDone.name,
                    payload: {
                        data: this.getSubmitArgs(state, action.payload.sourceId)
                    }
                });
            }
        ).sideEffectAlsoOn(MainMenuActions.DirectSave.name);

        this.addActionHandler(
            Actions.ResultApplyQuickFilter,
            null,
            (state, action, dispatch) => {
                this.pageModel.setLocationPost(action.payload.url, {}, action.payload.blankWindow);
            }
        );
    }

    private dispatchLoad(
        load:Observable<FreqResultResponse>,
        state:FreqDataRowsModelState,
        dispatch:SEDispatcher,
        pushHistory:boolean
    ):void {
        load.subscribe({
            next: data => {
                List.forEach(
                    (block, idx) => {
                        dispatch<typeof Actions.ResultDataLoaded>({
                            name: Actions.ResultDataLoaded.name,
                            payload: {
                                block: importData(
                                    this.pageModel,
                                    block,
                                    parseInt(state.currentPage[block.fcrit]),
                                    data.fmaxitems,
                                )
                            },
                        });
                    },
                    data.Blocks
                );
                if (pushHistory) {
                    dispatch<typeof Actions.StatePushToHistory>({
                        name: Actions.StatePushToHistory.name
                    });
                }
            },
            error: error => {
                dispatch<typeof Actions.ResultDataLoaded>({
                    name: Actions.ResultDataLoaded.name,
                    error
                });
            }
        });
    }

    private pushStateToHistory(state:FreqDataRowsModelState):void {
        const firstCrit = List.head(state.freqCrit);
        const args = {
            ...this.getSubmitArgs(state, firstCrit),
            fcrit_async: state.freqCritAsync,
            format: undefined
        };
        this.pageModel.getHistory().pushState(
            'freqs',
            args, // TODO do we use these?
            {
                onPopStateAction: {
                    name: Actions.PopHistory.name,
                    payload: {
                        currentPage: {...state.currentPage},
                        flimit: state.flimit,
                        sortColumn: {...state.sortColumn}
                    }
                }
            },
            window.document.title
        );
    }

    getSubmitArgs(state:FreqDataRowsModelState, fcrit:string):FreqServerArgs {
        return {
            ...this.pageModel.getConcArgs(),
            fcrit,
            flimit: parseInt(state.flimit),
            freq_sort: state.sortColumn[fcrit],
            fpage: state.currentPage[fcrit],
            ftt_include_empty: state.ftt_include_empty,
            freqlevel: 1,
            format: 'json'
        };
    }

    getSaveModel():FreqResultsSaveModel {
        return this.saveModel;
    }

}