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
import { IFullActionControl, SEDispatcher, StatelessModel } from 'kombo';
import { debounceTime, Observable, Subject } from 'rxjs';
import {
    BaseFreqModelState, clearResultBlock, EmptyResultBlock, FreqDataLoader,
    FreqServerArgs, isEmptyResultBlock, MulticritFreqServerArgs, PAGE_SIZE_INPUT_WRITE_THROTTLE_INTERVAL_MS,
    recalculateConfIntervals, ResultBlock, validateNumber } from './common';
import { Dict, List, Maths, pipe, tuple } from 'cnc-tskit';
import { ConcQuickFilterServerArgs } from '../../concordance/common';
import { Actions } from './actions';
import { Actions as MainMenuActions } from '../../mainMenu/actions';
import { TagsetInfo } from '../../../types/plugins/tagHelper';
import { Block, FreqResultResponse } from '../common';
import { Actions as GeneralOptsActions } from '../../options/actions';
import { AttrItem, BasicFreqModuleType, FormValue, newFormValue, updateFormValue } from '../../../types/kontext';


export interface FreqDataRowsModelArgs {
    dispatcher:IFullActionControl;
    pageModel:PageModel;
    freqType:BasicFreqModuleType;
    freqCrit:Array<AttrItem>;
    freqCritAsync:Array<AttrItem>;
    formProps:FreqFormInputs;
    initialData:Array<ResultBlock|EmptyResultBlock>;
    currentPage:number;
    freqLoader:FreqDataLoader;
}

export interface FreqDataRowsModelState extends BaseFreqModelState {
    displayConfidence:boolean;
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
    alphaLevel:Maths.AlphaLevel

):ResultBlock {
    const posTagAttrs = getPositionalTagAttrs(pageModel);
    return {
        Items: List.map(
            (item, i) => {
                const [normLeftConfidence, normRightConfidence] = Maths.wilsonConfInterval(
                    item.freq, item.norm, alphaLevel);
                return {
                    ...item,
                    relConfidence: tuple(
                        Maths.roundToPos(normLeftConfidence * 1e6, 2),
                        Maths.roundToPos(normRightConfidence * 1e6, 2)
                    ),
                    freqConfidence: tuple(
                        Maths.roundToPos(normLeftConfidence * item.norm, 2),
                        Maths.roundToPos(normRightConfidence * item.norm, 2)
                    ),
                    idx: i + (currentPage - 1) * pageSize,
                    Word: List.map(x => x.n, item.Word),
                    pfilter: createQuickFilterUrl(pageModel, item.pfilter),
                    nfilter: createQuickFilterUrl(pageModel, item.nfilter)
                }
            },
            data.Items
        ),
        Head: List.map(
            item => ({
                ...item,
                isPosTag: List.some(v => v === item.n, posTagAttrs),
                allowSorting: !data.NoRelSorting
            }),
            data.Head
        ),
        TotalPages: data.TotalPages,
        Total: data.Total,
        SkippedEmpty: data.SkippedEmpty,
        NoRelSorting: data.NoRelSorting,
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
    typeof Actions.ResultSetCurrentPage | typeof Actions.ResultSetMinFreqVal;


/**
 * FreqDataRowsModel handles traditional 'table' representation of frequencies
 */
export class FreqDataRowsModel extends StatelessModel<FreqDataRowsModelState> {

    private pageModel:PageModel;

    private freqLoader:FreqDataLoader;

    private readonly debouncedAction$:Subject<DebouncedActions>;

    constructor({
        dispatcher, pageModel, freqType, freqCrit, freqCritAsync, formProps,
        initialData, currentPage, freqLoader
    }:FreqDataRowsModelArgs) {
        const allCrit = List.concat(freqCrit, freqCritAsync);
        super(
            dispatcher,
            {
                freqType,
                data: pipe(
                    initialData,
                    List.map(v => tuple(v.fcrit, v)),
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
                currentPage: pipe(
                    allCrit,
                    List.map(
                        (k, i) => tuple(k.n, i === 0 ? `${currentPage}` : `1`)
                    ),
                    Dict.fromEntries()
                ),
                sortColumn: pipe(
                    allCrit,
                    List.map(
                        k => tuple(k.n, formProps.freq_sort)
                    ),
                    Dict.fromEntries()
                ),
                ftt_include_empty: formProps.ftt_include_empty,
                flimit: newFormValue(formProps.flimit || '0', true),
                isBusy: pipe(
                    allCrit,
                    List.map(
                        k => tuple(k.n, false)
                    ),
                    Dict.fromEntries()
                ),
                isActive: true,
                saveFormActive: false,
                alphaLevel: Maths.AlphaLevel.LEVEL_5,
                displayConfidence: false,
            }
        );
        this.pageModel = pageModel;
        this.freqLoader = freqLoader;
        this.debouncedAction$ = new Subject<DebouncedActions>();
        this.debouncedAction$.pipe(
            debounceTime(PAGE_SIZE_INPUT_WRITE_THROTTLE_INTERVAL_MS)

        ).subscribe({
            next: value => {
                dispatcher.dispatch({
                    ...value,
                    payload: {...value.payload, debouncedFor: 'tables'}
                });
            }
        });

        this.addActionHandler(
            Actions.ResultSetActiveTab,
            (state, action) => {
                state.isActive = action.payload.value === 'tables';
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

        this.addActionHandler(
            Actions.ToggleDisplayConfidence,
            (state, action) => {
                state.displayConfidence = action.payload.value;
            }
        );

        this.addActionHandler(
            Actions.ResultSetMinFreqVal,
            (state, action) => {
                if (action.payload.debouncedFor) {
                    if (validateNumber(action.payload.value, 0)) {
                        state.isBusy = Dict.map(v => true, state.isBusy);
                        state.flimit = updateFormValue(state.flimit, {isInvalid: false});
                        state.currentPage = Dict.map(_ => '1', state.currentPage);
                        if (!state.isActive) {
                            state.data = Dict.map(block => clearResultBlock(block), state.data);
                        }

                    } else {
                        state.flimit = updateFormValue(state.flimit, {isInvalid: true});
                    }

                } else {
                    state.flimit = updateFormValue(state.flimit, {value: action.payload.value});
                    this.debouncedAction$.next(action);
                }

            },
            (state, action, dispatch) => {
                if (action.payload.debouncedFor === 'tables') {
                    if (validateNumber(action.payload.value, 0)) {
                        if (state.isActive) {
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
                            );
                        }

                    } else if (state.isActive) {
                        this.pageModel.showMessage(
                            'error', this.pageModel.translate('freq__limit_invalid_val'));
                    }
                }
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
            GeneralOptsActions.GeneralSubmitDone,
            (state, action) => {
                state.isBusy = Dict.map(v => true, state.isBusy);
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
                );
            }
        );

        this.addActionHandler(
            Actions.ResultDataLoaded,
            (state, action) => {
                if (action.error) {
                    this.pageModel.showMessage('error', action.error);

                } else if (action.payload.block) {
                    state.isBusy[action.payload.block.fcrit] = false;
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
                state.flimit = updateFormValue(state.flimit, {value: action.payload.flimit});
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
                if (validateNumber(action.payload.value, 1)) {
                    state.isBusy[action.payload.sourceId] = true;

                } else {
                    state.isBusy[action.payload.sourceId] = false;
                }
                if (!action.payload.debouncedFor) {
                    this.debouncedAction$.next(action);
                }
            },
            (state, action, dispatch) => {
                if (action.payload.debouncedFor) {
                    if (validateNumber(action.payload.value, 1)) {
                        this.dispatchLoad(
                            this.freqLoader.loadPage(
                                this.getSubmitArgs(state, action.payload.sourceId)
                            ),
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
                        data: this.getAllCritSubmitArgs(state)
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
                                    state.alphaLevel
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
            ...this.getSubmitArgs(state, firstCrit.n),
            fcrit_async: List.map(v => v.n, state.freqCritAsync),
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
                        flimit: {...state.flimit},
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
            flimit: parseInt(state.flimit.value),
            freq_sort: state.sortColumn[fcrit],
            fpage: parseInt(state.currentPage[fcrit]),
            ftt_include_empty: state.ftt_include_empty,
            freqlevel: 1,
            format: 'json'
        };
    }

    getAllCritSubmitArgs(state:FreqDataRowsModelState):MulticritFreqServerArgs {
        return {
            ...this.pageModel.getConcArgs(),
            fcrit: Dict.keys(state.data),
            flimit: parseInt(state.flimit.value),
            freq_sort: 'freq',
            fpage: 1,
            ftt_include_empty: state.ftt_include_empty,
            freqlevel: 1,
            format: 'json'
        };
    }

}