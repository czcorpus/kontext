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

import {FreqResultResponse} from '../../types/ajaxResponses';
import {PageModel} from '../../app/page';
import {FreqFormInputs} from './freqForms';
import {FreqResultsSaveModel} from './save';
import {MultiDict} from '../../multidict';
import { IFullActionControl, StatelessModel } from 'kombo';
import { Observable } from 'rxjs';
import { FreqServerArgs } from './common';
import { HTTP, List } from 'cnc-tskit';
import { ConcQuickFilterServerArgs } from '../concordance/common';
import { ActionName, Actions } from './actions';
import { ActionName as MainMenuActionName, Actions as MainMenuActions } from '../mainMenu/actions';


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
}

export interface FreqDataRowsModelState {
    data:Array<ResultBlock>;
    currentPage:string;
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
            idx: i + currentPage * pageSize,
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
        const submitArgs = pageModel.getConcArgs() as MultiDict<ConcQuickFilterServerArgs>;
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
                quickSaveRowLimit, initialData}:FreqDataRowsModelArgs) {
        super(
            dispatcher,
            {
                data: initialData,
                freqCrit: freqCrit,
                currentPage: null,
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
            (state, action) => {state.isBusy = true},
            (state, action, dispatch) => {
                this.loadPage(state).subscribe(
                    (data) => {
                        dispatch<Actions.ResultDataLoaded>({
                            name: ActionName.ResultDataLoaded,
                            payload: {
                                data: importData(this.pageModel, data.Blocks, data.fmaxitems, parseInt(state.currentPage)),
                                resetPage: true
                            },
                        });
                    },
                    (err) => {
                        dispatch<Actions.ResultDataLoaded>({
                            name: ActionName.ResultDataLoaded,
                            payload: {data: null, resetPage: null},
                            error: err
                        });
                    }
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
                    if (action.payload.resetPage) {
                        state.currentPage = '1';
                        this.pushStateToHistory(state);
                    }
                }
            },
        );

        this.addActionHandler<Actions.ResultSortByColumn>(
            ActionName.ResultSortByColumn,
            (state, action) => {
                state.isBusy = true;
                state.sortColumn = action.payload.value;
            },
            (state, action, dispatch) => {
                this.loadPage(state).subscribe(
                    (data) => {
                        dispatch<Actions.ResultDataLoaded>({
                            name: ActionName.ResultDataLoaded,
                            payload: {
                                data: importData(this.pageModel, data.Blocks, data.fmaxitems, parseInt(state.currentPage)),
                                resetPage: false
                            },
                        });
                    },
                    (err) => {
                        dispatch<Actions.ResultDataLoaded>({
                            name: ActionName.ResultDataLoaded,
                            payload: {data: null, resetPage: null},
                            error: err
                        });
                    }
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
                    this.loadPage(state).subscribe(
                        (data) => {
                            dispatch<Actions.ResultDataLoaded>({
                                name: ActionName.ResultDataLoaded,
                                payload: {
                                    data: importData(this.pageModel, data.Blocks, data.fmaxitems, parseInt(state.currentPage)),
                                    resetPage: false
                                },
                            });
                        },
                        (err) => {
                            dispatch<Actions.ResultDataLoaded>({
                                name: ActionName.ResultDataLoaded,
                                payload: {data: null, resetPage: null},
                                error: err
                            });
                        }
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
    }

    unregister() {};

    private pushStateToHistory(state:FreqDataRowsModelState):void {
        const args = this.getSubmitArgs(state);
        args.remove('format');
        this.pageModel.getHistory().pushState(
            'freqs',
            args,
            {},
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
        const args = this.pageModel.getConcArgs() as MultiDict<FreqServerArgs>;
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
        );
    }

    getSaveModel():FreqResultsSaveModel {
        return this.saveModel;
    }

}