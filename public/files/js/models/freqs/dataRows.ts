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

import { FreqResultResponse } from '../../types/ajaxResponses';
import { PageModel } from '../../app/page';
import { FreqFormInputs } from './freqForms';
import { FreqResultsSaveModel } from './save';
import { MultiDict } from '../../multidict';
import { IFullActionControl, SEDispatcher, StatelessModel } from 'kombo';
import { Observable } from 'rxjs';
import { FreqServerArgs, HistoryState } from './common';
import { HTTP, List } from 'cnc-tskit';
import { ConcQuickFilterServerArgs } from '../concordance/common';
import { ActionName, Actions } from './actions';
import { ActionName as MainMenuActionName, Actions as MainMenuActions } from '../mainMenu/actions';
import { Action } from 'rxjs/internal/scheduler/Action';
import { catchError } from 'rxjs/operators';
import { ajaxErrorMapped } from '../../app/navigation';


export interface ResultItem {
    idx:number;
    Word:Array<string>;
    pfilter:string;
    nfilter:string;
    fbar:number;
    freqbar:number;
    rel:number;
    relbar:number;
    freq:number;
    nbar:number;
    norm:number;
    norel:number; // 0|1 (TODO bool?)
}

export interface ResultHeader {
    s:string;
    n:string;
}

export interface ResultBlock {
    TotalPages:number;
    Total:number;
    Items:Array<ResultItem>;
    Head:Array<ResultHeader>;
}

export interface FreqDataRowsModelArgs {
    dispatcher:IFullActionControl;
    pageModel:PageModel;
    freqCrit:Array<[string, string]>;
    formProps:FreqFormInputs;
    quickSaveRowLimit:number;
    saveLinkFn:(file:string, url:string)=>void;
    initialData:Array<ResultBlock>;
    currentPage:number;
}

export interface FreqDataRowsModelState {
    data:Array<ResultBlock>;
    currentPage:string|null; // null means multi-block output which cannot be paginated
    sortColumn:string
    freqCrit:Array<[string, string]>;
    ftt_include_empty:boolean;
    flimit:string;
    isBusy:boolean;
    saveFormActive:boolean;
}

export function importData(pageModel:PageModel, data:Array<FreqResultResponse.Block>, pageSize:number, currentPage:number):Array<ResultBlock> {
    return List.map(item => ({
        Items: List.map((item, i) => ({
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
        }), item.Items),
        Head: item.Head,
        TotalPages: item.TotalPages,
        Total: item.Total
    }), data);
}

function createQuickFilterUrl(pageModel:PageModel, args:Array<[keyof ConcQuickFilterServerArgs, ConcQuickFilterServerArgs[keyof ConcQuickFilterServerArgs]]>):string {
    if (args && args.length > 0) {
        const submitArgs = pageModel.exportConcArgs() as MultiDict<ConcQuickFilterServerArgs>;
        submitArgs.remove('q2');
        args.forEach(([key, value]) => submitArgs.add(key, value));
        return pageModel.createActionUrl('quick_filter', submitArgs.items());

    } else {
        return null;
    }
}

export class FreqDataRowsModel extends StatelessModel<FreqDataRowsModelState> {

    private pageModel:PageModel;

    private saveModel:FreqResultsSaveModel;

    constructor({dispatcher, pageModel, freqCrit, formProps, saveLinkFn,
                quickSaveRowLimit, initialData, currentPage}:FreqDataRowsModelArgs) {
        super(
            dispatcher,
            {
                data: initialData,
                freqCrit: freqCrit,
                currentPage: initialData.length > 1 ? null : `${currentPage}`,
                sortColumn: formProps.freq_sort,
                ftt_include_empty: formProps.ftt_include_empty,
                flimit: formProps.flimit || '0',
                isBusy: false,
                saveFormActive: false
            }
        );
        this.pageModel = pageModel;

        this.saveModel = new FreqResultsSaveModel({
            dispatcher: dispatcher,
            layoutModel: pageModel,
            saveLinkFn: saveLinkFn,
            quickSaveRowLimit: quickSaveRowLimit
        });

        this.addActionHandler<MainMenuActions.ShowSaveForm>(
            MainMenuActionName.ShowSaveForm,
            (state, action) => {state.saveFormActive = true}
        );

        this.addActionHandler<Actions.ResultCloseSaveForm>(
            ActionName.ResultCloseSaveForm,
            (state, action) => {state.saveFormActive = false}
        );

        this.addActionHandler<Actions.ResultSetMinFreqVal>(
            ActionName.ResultSetMinFreqVal,
            (state, action) => {
                if (this.validateNumber(action.payload.value, 0)) {
                    state.flimit = action.payload.value;

                } else {
                    this.pageModel.showMessage('error', this.pageModel.translate('freq__limit_invalid_val'));
                }
            }
        );

        this.addActionHandler<Actions.ResultApplyMinFreq>(
            ActionName.ResultApplyMinFreq,
            (state, action) => {
                state.isBusy = true,
                state.currentPage = '1';
            },
            (state, action, dispatch) => {
                this.dispatchLoad(
                    this.loadPage(state),
                    state,
                    dispatch,
                    true
                );
            }
        );

        this.addActionHandler<Actions.ResultDataLoaded>(
            ActionName.ResultDataLoaded,
            (state, action) => {
                state.isBusy = false;
                if (action.error) {
                    this.pageModel.showMessage('error', action.error);

                } else {
                    state.data = action.payload.data;
                }
            }
        );

        this.addActionHandler<Actions.StatePushToHistory>(
            ActionName.StatePushToHistory,
            (state, action) => {
                this.pushStateToHistory(state);
            }
        );

        this.addActionHandler<Actions.PopHistory>(
            ActionName.PopHistory,
            (state, action) => {
                state.currentPage = action.payload.currentPage;
                state.flimit = action.payload.flimit;
                state.sortColumn = action.payload.sortColumn;
            },
            (state, action, dispatch) => {
                this.dispatchLoad(
                    this.loadPage(state),
                    state,
                    dispatch,
                    false
                );
            }
        );

        this.addActionHandler<Actions.ResultSortByColumn>(
            ActionName.ResultSortByColumn,
            (state, action) => {
                state.isBusy = true;
                state.sortColumn = action.payload.value;
            },
            (state, action, dispatch) => {
                this.dispatchLoad(
                    this.loadPage(state),
                    state,
                    dispatch,
                    true
                );
            }
        );

        this.addActionHandler<Actions.ResultSetCurrentPage>(
            ActionName.ResultSetCurrentPage,
            (state, action) => {
                if (this.validateNumber(action.payload.value, 1)) {
                    state.isBusy = true;
                    state.currentPage = action.payload.value;
                } else {
                    this.pageModel.showMessage('error', this.pageModel.translate('freq__page_invalid_val'));
                }
            },
            (state, action, dispatch) => {
                if (this.validateNumber(action.payload.value, 1)) {
                    this.dispatchLoad(
                        this.loadPage(state),
                        state,
                        dispatch,
                        true
                    );
                }
            }
        );

        this.addActionHandler<Actions.SaveFormSubmit>(
            ActionName.SaveFormSubmit,
            null,
            (state, action, dispatch) => {
                dispatch<Actions.ResultPrepareSubmitArgsDone>({
                    name: ActionName.ResultPrepareSubmitArgsDone,
                    payload: {data: this.getSubmitArgs(state)}
                })
            }
        );

        this.addActionHandler<Actions.ResultApplyQuickFilter>(
            ActionName.ResultApplyQuickFilter,
            null,
            (state, action, dispatch) => {
                this.pageModel.setLocationPost(action.payload.url, [], action.payload.blankWindow);
            }
        );
    }

    private dispatchLoad(
        load:Observable<FreqResultResponse.FreqResultResponse>,
        state:FreqDataRowsModelState,
        dispatch:SEDispatcher,
        pushHistory:boolean
    ):void {

        load.subscribe(
            (data) => {
                dispatch<Actions.ResultDataLoaded>({
                    name: ActionName.ResultDataLoaded,
                    payload: {
                        data: importData(
                            this.pageModel,
                            data.Blocks,
                            data.fmaxitems,
                            parseInt(state.currentPage)
                        )
                    },
                });
                if (pushHistory) {
                    dispatch<Actions.StatePushToHistory>({
                        name: ActionName.StatePushToHistory
                    });
                }
            },
            (err) => {
                dispatch<Actions.ResultDataLoaded>({
                    name: ActionName.ResultDataLoaded,
                    payload: {data: null},
                    error: err
                });
            }
        );
    }

    private pushStateToHistory(state:FreqDataRowsModelState):void {
        const args = this.getSubmitArgs(state);
        args.remove('format');
        const hstate:HistoryState = {
            currentPage: state.currentPage,
            flimit: state.flimit,
            sortColumn: state.sortColumn
        };
        this.pageModel.getHistory().pushState(
            'freqs',
            args,
            hstate,
            window.document.title
        );
    }

    validateNumber(v:string, minNum:number):boolean {
        if (v === '') {
            return true;

        } else if (/^(0|[1-9][0-9]*)$/.exec(v) !== null) {
            return parseInt(v) >= minNum;
        }
        return false;
    }

    getSubmitArgs(state:FreqDataRowsModelState):MultiDict {
        const args = this.pageModel.exportConcArgs() as MultiDict<FreqServerArgs>;
        args.remove('fcrit');
        state.freqCrit.forEach((item) => {
            args.add(item[0], item[1]);
        });
        args.set('flimit', parseInt(state.flimit));
        args.set('freq_sort', state.sortColumn);
        // fpage: for client, null means 'multi-block' output, for server '1' must be filled in
        args.set('fpage', state.currentPage !== null ? state.currentPage : '1');
        args.set('ftt_include_empty', state.ftt_include_empty ? '1' : '0');
        args.set('format', 'json');
        return args;
    }

    loadPage(state:FreqDataRowsModelState):Observable<FreqResultResponse.FreqResultResponse> {
        return this.pageModel.ajax$<FreqResultResponse.FreqResultResponse>(
            HTTP.Method.GET,
            this.pageModel.createActionUrl('freqs'),
            this.getSubmitArgs(state)

        ).pipe(
            ajaxErrorMapped({
                502: this.pageModel.translate('global__human_readable_502')
            }),
        )
    }

    getSaveModel():FreqResultsSaveModel {
        return this.saveModel;
    }

}