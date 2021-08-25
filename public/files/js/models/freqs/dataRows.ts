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

import { PageModel } from '../../app/page';
import { FreqFormInputs } from './freqForms';
import { FreqResultsSaveModel } from './save';
import { IFullActionControl, SEDispatcher, StatelessModel } from 'kombo';
import { Observable } from 'rxjs';
import { FreqServerArgs } from './common';
import { HTTP, List } from 'cnc-tskit';
import { ConcQuickFilterServerArgs } from '../concordance/common';
import { Actions } from './actions';
import { Actions as MainMenuActions } from '../mainMenu/actions';
import { ajaxErrorMapped } from '../../app/navigation';
import * as response from './response';


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
    SkippedEmpty:boolean;
}

export interface FreqDataRowsModelArgs {
    dispatcher:IFullActionControl;
    pageModel:PageModel;
    freqCrit:Array<string>;
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
    freqCrit:Array<string>;
    ftt_include_empty:boolean;
    flimit:string;
    isBusy:boolean;
    saveFormActive:boolean;
}

export function importData(
    pageModel:PageModel,
    data:Array<response.Block>,
    pageSize:number,
    currentPage:number
):Array<ResultBlock> {

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
        Total: item.Total,
        SkippedEmpty: item.SkippedEmpty
    }), data);
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

export class FreqDataRowsModel extends StatelessModel<FreqDataRowsModelState> {

    private pageModel:PageModel;

    private saveModel:FreqResultsSaveModel;

    constructor({dispatcher, pageModel, freqCrit, formProps, saveLinkFn,
                quickSaveRowLimit, initialData, currentPage}:FreqDataRowsModelArgs) {
        super(
            dispatcher,
            {
                data: initialData,
                freqCrit,
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

        this.addActionHandler<typeof MainMenuActions.ShowSaveForm>(
            MainMenuActions.ShowSaveForm.name,
            (state, action) => {state.saveFormActive = true}
        );

        this.addActionHandler<typeof Actions.ResultCloseSaveForm>(
            Actions.ResultCloseSaveForm.name,
            (state, action) => {state.saveFormActive = false}
        );

        this.addActionHandler<typeof Actions.ResultSetMinFreqVal>(
            Actions.ResultSetMinFreqVal.name,
            (state, action) => {
                if (this.validateNumber(action.payload.value, 0)) {
                    state.flimit = action.payload.value;

                } else {
                    this.pageModel.showMessage('error', this.pageModel.translate('freq__limit_invalid_val'));
                }
            }
        );

        this.addActionHandler<typeof Actions.ResultApplyMinFreq>(
            Actions.ResultApplyMinFreq.name,
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

        this.addActionHandler<typeof Actions.ResultDataLoaded>(
            Actions.ResultDataLoaded.name,
            (state, action) => {
                state.isBusy = false;
                if (action.error) {
                    this.pageModel.showMessage('error', action.error);

                } else {
                    state.data = action.payload.data;
                }
            }
        );

        this.addActionHandler<typeof Actions.StatePushToHistory>(
            Actions.StatePushToHistory.name,
            (state, action) => {
                this.pushStateToHistory(state);
            }
        );

        this.addActionHandler<typeof Actions.PopHistory>(
            Actions.PopHistory.name,
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

        this.addActionHandler<typeof Actions.ResultSortByColumn>(
            Actions.ResultSortByColumn.name,
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

        this.addActionHandler<typeof Actions.ResultSetCurrentPage>(
            Actions.ResultSetCurrentPage.name,
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

        this.addActionHandler<typeof Actions.SaveFormSubmit>(
            Actions.SaveFormSubmit.name,
            null,
            (state, action, dispatch) => {
                dispatch<typeof Actions.ResultPrepareSubmitArgsDone>({
                    name: Actions.ResultPrepareSubmitArgsDone.name,
                    payload: {data: this.getSubmitArgs(state)}
                })
            }
        ).sideEffectAlsoOn(MainMenuActions.DirectSave.name);

        this.addActionHandler<typeof Actions.ResultApplyQuickFilter>(
            Actions.ResultApplyQuickFilter.name,
            null,
            (state, action, dispatch) => {
                this.pageModel.setLocationPost(action.payload.url, [], action.payload.blankWindow);
            }
        );
    }

    private dispatchLoad(
        load:Observable<response.FreqResultResponse>,
        state:FreqDataRowsModelState,
        dispatch:SEDispatcher,
        pushHistory:boolean
    ):void {

        load.subscribe(
            (data) => {
                dispatch<typeof Actions.ResultDataLoaded>({
                    name: Actions.ResultDataLoaded.name,
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
                    dispatch<typeof Actions.StatePushToHistory>({
                        name: Actions.StatePushToHistory.name
                    });
                }
            },
            (err) => {
                dispatch<typeof Actions.ResultDataLoaded>({
                    name: Actions.ResultDataLoaded.name,
                    payload: {data: null},
                    error: err
                });
            }
        );
    }

    private pushStateToHistory(state:FreqDataRowsModelState):void {
        const args = this.getSubmitArgs(state);
        args.remove('format');
        this.pageModel.getHistory().pushState(
            'freqs',
            args,
            {
                onPopStateAction: {
                    name: Actions.PopHistory.name,
                    payload: {
                        currentPage: state.currentPage,
                        flimit: state.flimit,
                        sortColumn: state.sortColumn
                    }
                }
            },
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

    getSubmitArgs(state:FreqDataRowsModelState):FreqServerArgs {
        return {
            ...this.pageModel.getConcArgs(),
            ...state.freqCrit,
            flimit: parseInt(state.flimit),
            freq_sort: state.sortColumn,
            // fpage: for client, null means 'multi-block' output, for server '1' must be filled in
            fpage: state.currentPage !== null ? state.currentPage : '1',
            ftt_include_empty: state.ftt_include_empty,
            freqlevel: 1,
            format: 'json'
        };
    }

    loadPage(state:FreqDataRowsModelState):Observable<response.FreqResultResponse> {
        return this.pageModel.ajax$<response.FreqResultResponse>(
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