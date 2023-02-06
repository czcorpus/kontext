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
import { Observable } from 'rxjs';
import {
    EmptyResultBlock, FreqDataLoader, FreqDataRowsModelState, FreqServerArgs, isEmptyResultBlock,
    isFreqChartsModelState, MulticritFreqServerArgs, recalculateConfIntervals, ResultBlock } from './common';
import { Dict, List, Maths, pipe, tuple } from 'cnc-tskit';
import { ConcQuickFilterServerArgs } from '../../concordance/common';
import { Actions } from './actions';
import { Actions as MainMenuActions } from '../../mainMenu/actions';
import { TagsetInfo } from '../../../types/plugins/tagHelper';
import { Block, FreqResultResponse } from '../common';
import { Actions as GeneralOptsActions } from '../../options/actions';
import { AttrItem, BasicFreqModuleType } from '../../../types/kontext';
import { validateGzNumber } from '../../base';
// !!! import * as copy from 'copy-to-clipboard';


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
    forcedParams:{[sourceId:string]:{[key:string]:any}};
    alphaLevel:Maths.AlphaLevel;
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
                        Maths.roundToPos(normLeftConfidence * 1e6, 3),
                        Maths.roundToPos(normRightConfidence * 1e6, 3)
                    ),
                    freqConfidence: tuple(
                        Maths.roundToPos(normLeftConfidence * item.norm, 3),
                        Maths.roundToPos(normRightConfidence * item.norm, 3)
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


/**
 * FreqDataRowsModel handles traditional 'table' representation of frequencies
 */
export class FreqDataRowsModel extends StatelessModel<FreqDataRowsModelState> {

    private pageModel:PageModel;

    private freqLoader:FreqDataLoader;

    constructor({
        dispatcher, pageModel, freqType, freqCrit, freqCritAsync, formProps,
        initialData, currentPage, freqLoader, forcedParams, alphaLevel
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
                        (k, i) => tuple(k.n, forcedParams[k.n]?.fpage ? `${forcedParams[k.n]?.fpage}` : i === 0 ? `${currentPage}` : `1`)
                    ),
                    Dict.fromEntries()
                ),
                sortColumn: pipe(
                    allCrit,
                    List.map(
                        k => tuple(k.n, forcedParams[k.n]?.freq_sort || formProps.freq_sort || 'freq')
                    ),
                    Dict.fromEntries()
                ),
                ftt_include_empty: formProps.ftt_include_empty,
                isBusy: pipe(
                    allCrit,
                    List.map(
                        k => tuple(k.n, false)
                    ),
                    Dict.fromEntries()
                ),
                isError: pipe(
                    allCrit,
                    List.map(
                        k => tuple(k.n, null)
                    ),
                    Dict.fromEntries()
                ),
                isActive: true,
                saveFormActive: false,
                alphaLevel: alphaLevel,
                displayConfidence: false,
                flimit: parseInt(formProps.flimit) || 0
            }
        );
        this.pageModel = pageModel;
        this.freqLoader = freqLoader;

        this.addActionHandler(
            Actions.ResultSetActiveTab,
            (state, action) => {
                state.isActive = action.payload.value === 'tables';
            },
            (state, action, dispatch) => {
                if (state.isActive) {
                    this.pushStateToHistory(state);
                }
            }
        );

        this.addActionHandler(
            Actions.ResultLinkCopyToClipboard,
            (state, action) => {
                if (state.isActive) {
                    // !!! copy(this.getShareLink(state, action.payload.sourceId));
                    this.pageModel.showMessage('info', this.pageModel.translate('global__link_copied_to_clipboard'));
                }
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
                                            this.getSubmitArgs(
                                                state, fcrit, action.payload.value, 1)),
                                        state,
                                        dispatch,
                                        true,
                                        fcrit,
                                    );
                                },
                                state.data
                            );
                        }
                    },
                );
            }
        );

        this.addActionHandler(
            Actions.ReloadData,
            (state, action) => {
                state.isBusy[action.payload.sourceId] = true;
                state.isError[action.payload.sourceId] = null;
            },
            (state, action, dispatch) => {
                this.dispatchLoad(
                    this.freqLoader.loadPage(
                        this.getSubmitArgs(
                            state,
                            action.payload.sourceId,
                            state.flimit,
                            parseInt(state.currentPage[action.payload.sourceId])
                        )
                    ),
                    state,
                    dispatch,
                    false,
                    action.payload.sourceId,
                );
            }
        );

        this.addActionHandler(
            GeneralOptsActions.GeneralSubmitDone,
            (state, action) => {
                state.isBusy = Dict.map(v => true, state.isBusy);
                state.isError = Dict.map(v => null, state.isError);
            },
            (state, action, dispatch) => {
                Dict.forEach(
                    (block, fcrit) => {
                        this.dispatchLoad(
                            this.freqLoader.loadPage(
                                this.getSubmitArgs(
                                    state,
                                    fcrit,
                                    state.flimit,
                                    parseInt(state.currentPage[fcrit])
                                    )
                                ),
                            state,
                            dispatch,
                            true,
                            fcrit,
                        );
                    },
                    state.data
                );
            }
        );

        this.addActionHandler(
            Actions.ResultDataLoaded,
            (state, action) => {
                state.isBusy[action.payload.sourceId] = false;
                if (action.error) {
                    this.pageModel.showMessage('error', action.error);
                    state.isError[action.payload.sourceId] = action.error;

                } else {
                    state.data = {
                        ...state.data,
                        [action.payload.data.fcrit]: action.payload.data
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
                const storedState = action.payload.state;
                if (!isFreqChartsModelState(storedState)) {
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
                    state.displayConfidence = storedState.displayConfidence;
                }
            },
            (state, action, dispatch) => {
                if (action.payload.activeView === 'tables') {
                    Dict.forEach(
                        (_, fcrit) => {
                            this.dispatchLoad(
                                this.freqLoader.loadPage(
                                    this.getSubmitArgs(
                                        state,
                                        fcrit,
                                        state.flimit,
                                        parseInt(state.currentPage[fcrit])
                                    )
                                ),
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
            Actions.ResultSortByColumn,
            (state, action) => {
                state.isBusy[action.payload.sourceId] = true;
                state.isError[action.payload.sourceId] = null;
                state.sortColumn[action.payload.sourceId] = action.payload.value;
            },
            (state, action, dispatch) => {
                this.dispatchLoad(
                    this.freqLoader.loadPage(
                        this.getSubmitArgs(
                            state,
                            action.payload.sourceId,
                            state.flimit,
                            parseInt(state.currentPage[action.payload.sourceId])
                        )
                    ),
                    state,
                    dispatch,
                    true,
                    action.payload.sourceId,
                );
            }
        );

        this.addActionHandler(
            Actions.ResultSetCurrentPage,
            (state, action) => {
                if (validateGzNumber(action.payload.value)) {
                    const sourceId = action.payload.sourceId;
                    state.currentPage[sourceId] = action.payload.value;

                    if (parseInt(action.payload.value) > state.data[sourceId].TotalPages) {
                        state.currentPage[sourceId] = `${state.data[sourceId].TotalPages}`;
                        this.pageModel.showMessage('info', this.pageModel.translate('global__no_more_pages'));
                    }
                    state.isBusy[sourceId] = true;
                    state.isError[sourceId] = null;
                }
            },
            (state, action, dispatch) => {
                if (validateGzNumber(action.payload.value)) {
                    this.dispatchLoad(
                        this.freqLoader.loadPage(
                            this.getSubmitArgs(
                                state,
                                action.payload.sourceId,
                                state.flimit,
                                parseInt(action.payload.value)
                            )
                        ),
                        state,
                        dispatch,
                        true,
                        action.payload.sourceId
                    );
                } else {
                    this.pageModel.showMessage(
                        'error', this.pageModel.translate('freq__page_invalid_val'));
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

    private pushStateToHistory(state:FreqDataRowsModelState):void {
        const firstCrit = List.head(state.freqCrit);
        const args = {
            ...this.getSubmitArgs(
                state,
                firstCrit.n,
                state.flimit,
                parseInt(state.currentPage[firstCrit.n])),
            fcrit_async: List.map(v => v.n, state.freqCritAsync),
            fdefault_view: 'tables',
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
                        activeView: 'tables',
                        state: JSON.parse(JSON.stringify(state))
                    }
                }
            },
            window.document.title
        );
    }

    private dispatchLoad(
        load:Observable<FreqResultResponse>,
        state:FreqDataRowsModelState,
        dispatch:SEDispatcher,
        pushHistory:boolean,
        sourceId:string,
    ):void {
        load.subscribe({
            next: data => {
                List.forEach(
                    (block, idx) => {
                        dispatch(
                            Actions.ResultDataLoaded,
                            {
                                data: importData(
                                    this.pageModel,
                                    block,
                                    parseInt(state.currentPage[block.fcrit]),
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
                        name: Actions.StatePushToHistory.name
                    });
                }
            },
            error: error => {
                dispatch(
                    Actions.ResultDataLoaded,
                    {data: undefined, sourceId},
                    error,
                );
            }
        });
    }

    private getShareLink(state:FreqDataRowsModelState, sourceId:string) {
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
                fpage: state.currentPage[sourceId],
                freq_sort: state.sortColumn[sourceId],
                fdefault_view: 'tables',
            }
        )
    }

    getSubmitArgs(state:FreqDataRowsModelState, fcrit:string, flimit:number, fpage:number):FreqServerArgs {
        return {
            ...this.pageModel.getConcArgs(),
            fcrit,
            flimit,
            freq_sort: state.sortColumn[fcrit],
            freq_type: state.freqType,
            fpage,
            ftt_include_empty: state.ftt_include_empty,
            freqlevel: 1,
            format: 'json',
        };
    }

    getAllCritSubmitArgs(state:FreqDataRowsModelState):MulticritFreqServerArgs {
        return {
            ...this.pageModel.getConcArgs(),
            fcrit: Dict.keys(state.data),
            flimit: state.flimit,
            freq_sort: 'freq',
            freq_type: state.freqType,
            fpage: 1,
            ftt_include_empty: state.ftt_include_empty,
            freqlevel: 1,
            format: 'json',
        };
    }

}