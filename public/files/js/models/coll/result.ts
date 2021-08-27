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

import { StatelessModel, SEDispatcher, IActionDispatcher } from 'kombo';
import { forkJoin, Observable, of } from 'rxjs';
import { concatMap } from 'rxjs/operators';

import { validateGzNumber } from '../../models/base';
import { PageModel } from '../../app/page';
import { CollFormModel } from '../../models/coll/collForm';
import { Actions } from './actions';
import { Actions as MainMenuActions } from '../mainMenu/actions';
import { HTTP, List } from 'cnc-tskit';
import { CollResultData, CollResultHeading, CollResultRow, CollResultHeadingCell,
    AjaxResponse, CollServerArgs, CollSaveServerArgs } from './common';
import { CalcWatchdog } from './calc';
import { ConcQuickFilterServerArgs } from '../concordance/common';



export interface CollResulModelArgs {
    dispatcher:IActionDispatcher;
    layoutModel:PageModel;
    formModel:CollFormModel;
    initialData:CollResultData;
    resultHeading:CollResultHeading;
    pageSize:number;
    saveLinesLimit:number;
    unfinished:boolean;
    sortFn:string;
    cattr:string;
    currPage:number;
}

export interface CollResultModelState {
    data:Array<CollResultRow>;
    heading:Array<CollResultHeadingCell>;
    currPage:number;
    currPageInput:string; // this is transformed into a real page change once user hits enter/button
    isWaiting:boolean;
    pageSize:number;
    hasNextPage:boolean;
    saveLinesLimit:number;
    calcStatus:number; // in per-cent (i.e. 0...100)
    quickSaveRowLimit:number;
    sortFn:string;
    cattr:string;
    saveFormVisible:boolean;
}

/**
 *
 */
export class CollResultModel extends StatelessModel<CollResultModelState> {

    private readonly layoutModel:PageModel;

    private readonly calcWatchdog:CalcWatchdog;

    constructor({
            dispatcher, layoutModel, initialData, resultHeading,
            pageSize, saveLinesLimit, unfinished, sortFn, cattr, currPage}:CollResulModelArgs) {
        super(
            dispatcher,
            {
                data: [...initialData],
                heading: resultHeading.slice(1),
                currPageInput: `${currPage}`,
                currPage: currPage,
                isWaiting: false,
                pageSize: pageSize,
                hasNextPage: true, // we do not know in advance in case of collocations
                saveLinesLimit: saveLinesLimit,
                calcStatus: unfinished ? 0 : 100,
                quickSaveRowLimit: 0,
                sortFn: sortFn,
                cattr: cattr,
                saveFormVisible: false
            }
        );
        this.layoutModel = layoutModel;

        this.calcWatchdog = new CalcWatchdog(layoutModel, (status, err) => {
            if (err === null) {
                dispatcher.dispatch<typeof Actions.ResultUpdateCalculation>({
                    name: Actions.ResultUpdateCalculation.name,
                    payload: {
                        calcStatus: status
                    }
                });

                if (status >= 100) {
                    this.calcWatchdog.stopWatching();
                    dispatcher.dispatch<typeof Actions.ResultReload>({
                        name: Actions.ResultReload.name
                    });
                }

            } else {
                this.calcWatchdog.stopWatching();
                dispatcher.dispatch<typeof Actions.ResultUpdateCalculation>({
                    name: Actions.ResultUpdateCalculation.name,
                    payload: {
                        calcStatus: 1000
                    },
                    error: err
                });
            }
        });
        if (unfinished) {
            this.calcWatchdog.startWatching();
        }

        this.addActionHandler<typeof Actions.ResultReload>(
            Actions.ResultReload.name,
            (state, action) => {
                state.isWaiting = true;
            },
            (state, action, dispatch) => {
                this.dispatchLoad(
                    this.processDataReload(state),
                    dispatch,
                    true
                );
            }
        )

        this.addActionHandler<typeof Actions.ResultUpdateCalculation>(
            Actions.ResultUpdateCalculation.name,
            (state, action) => {
                state.calcStatus = action.payload.calcStatus;
            },
            (state, action, dispatch) => {
                if (action.error) {
                    this.layoutModel.showMessage('error', action.error);
                }
            }
        );

        this.addActionHandler<typeof Actions.ResultSetPageInputVal>(
            Actions.ResultSetPageInputVal.name,
            (state, action) => {
                state.currPageInput = action.payload.value;
            },
            (state, action, dispatch) => {
                if (!validateGzNumber(state.currPageInput)) {
                    this.layoutModel.showMessage('error', this.layoutModel.translate('concview__invalid_page_num_err'));
                }
            }
        );

        this.addActionHandler<typeof Actions.ResultGetNextPage>(
            Actions.ResultGetNextPage.name,
            (state, action) => {
                state.isWaiting = true;
                state.currPage += 1;
                state.currPageInput = `${state.currPage}`;
            },
            (state, action, dispatch) => {
                this.dispatchLoad(
                    this.processDataReload(state),
                    dispatch,
                    true
                );
            }
        );

        this.addActionHandler<typeof Actions.ResultGetPrevPage>(
            Actions.ResultGetPrevPage.name,
            (state, action) => {
                state.isWaiting = true;
                state.currPage -= 1;
                state.currPageInput = `${state.currPage}`;
            },
            (state, action, dispatch) => {
                this.dispatchLoad(
                    this.processDataReload(state),
                    dispatch,
                    true
                );
            }
        );

        this.addActionHandler<typeof Actions.ResultConfirmPageValue>(
            Actions.ResultConfirmPageValue.name,
            (state, action) => {
                state.isWaiting = true;
                state.currPage = parseInt(state.currPageInput);
            },
            (state, action, dispatch) => {
                this.dispatchLoad(
                    this.processDataReload(state),
                    dispatch,
                    true
                );
            }
        );

        this.addActionHandler<typeof Actions.ResultPageLoadDone>(
            Actions.ResultPageLoadDone.name,
            (state, action) => {
                state.isWaiting = false;

                if (action.payload.response.Items.length === 0) {
                    state.hasNextPage = false;
                    state.currPage -= 1;
                    state.currPageInput = state.currPage + '';

                } else if (action.payload.response.Items.length < state.pageSize) {
                    state.hasNextPage = false;
                    state.data = action.payload.response.Items;

                } else {
                    state.heading = List.slice(1, action.payload.response.Head.length, action.payload.response.Head);
                    state.data = action.payload.response.Items;
                }
            }
        );

        this.addActionHandler<typeof Actions.ResultSortByColumn>(
            Actions.ResultSortByColumn.name,
            (state, action) => {
                state.sortFn = action.payload.sortFn;
                state.isWaiting = true;
            },
            (state, action, dispatch) => {
                this.dispatchLoad(
                    this.processDataReload(state),
                    dispatch,
                    true
                );
            }
        );

        this.addActionHandler<typeof Actions.ResultApplyQuickFilter>(
            Actions.ResultApplyQuickFilter.name,
            (state, action) => {

            },
            (state, action, dispatch) => {
                this.applyQuickFilter(action.payload.args, action.payload.blankWindow);
            }
        );

        this.addActionHandler<typeof Actions.StatePushToHistory>(
            Actions.StatePushToHistory.name,
            (state, action) => {
                this.pushStateToHistory(state, action.payload);
            }
        );

        this.addActionHandler<typeof Actions.PopHistory>(
            Actions.PopHistory.name,
            (state, action) => {
                state.currPage = action.payload.currPage;
                state.currPageInput = `${action.payload.currPage}`
                state.sortFn = action.payload.sortFn;
            },
            (state, action, dispatch) => {
                this.dispatchLoad(
                    this.processDataReload(state),
                    dispatch,
                    false
                );
            }
        );


        this.addActionHandler<typeof MainMenuActions.ShowSaveForm>(
            MainMenuActions.ShowSaveForm.name,
            (state, action) => {
                state.saveFormVisible = true;
            }
        );

        this.addActionHandler<typeof Actions.ResultCloseSaveForm>(
            Actions.ResultCloseSaveForm.name,
            (state, action) => {
                state.saveFormVisible = false;
            }
        );
    }

    private applyQuickFilter(args:ConcQuickFilterServerArgs, blankWindow:boolean) {
        const submitArgs = {...this.layoutModel.getConcArgs(), ...args};
        this.layoutModel.setLocationPost(
            this.layoutModel.createActionUrl('quick_filter', submitArgs),
            {}, blankWindow);
    }

    private processDataReload(state:CollResultModelState):Observable<[AjaxResponse, CollServerArgs]> {
        return this.suspend({}, (action, syncData) => {
            if (action.name === Actions.FormPrepareSubmitArgsDone.name) {
                return null;
            }
            return syncData;

        }).pipe(
            concatMap(
                action => {
                    const payload = (action as typeof Actions.FormPrepareSubmitArgsDone).payload;
                    return forkJoin([this.loadData(state, payload.args), of(payload.args)]);
                }
            )
        );
    }

    private dispatchLoad(
        load:Observable<[AjaxResponse, CollServerArgs]>,
        dispatch:SEDispatcher,
        pushHistory:boolean
    ):void {

        load.subscribe({
            next: ([data, args]) => {
                if (data.Items.length === 0) {
                    this.layoutModel.showMessage('info', this.layoutModel.translate('global__no_more_pages'));
                }
                dispatch<typeof Actions.ResultPageLoadDone>({
                    name: Actions.ResultPageLoadDone.name,
                    payload: {
                        response: data
                    }
                });
                if (pushHistory) {
                    dispatch<typeof Actions.StatePushToHistory>({
                        name: Actions.StatePushToHistory.name,
                        payload: args
                    });
                }
            },
            error: error => {
                dispatch<typeof Actions.ResultPageLoadDone>({
                    name: Actions.ResultPageLoadDone.name,
                    error
                });
            }
        });
    }

    private pushStateToHistory(state:CollResultModelState, formArgs:CollServerArgs):void {
        this.layoutModel.getHistory().pushState(
            'collx',
            {...formArgs, format: undefined},
            {
                onPopStateAction: {
                    name: Actions.PopHistory.name,
                    payload: {
                        currPage: state.currPage,
                        currPageInput: state.currPageInput,
                        sortFn: state.sortFn
                    }
                }
            },
            window.document.title
        );
    }

    getSubmitArgs(
        state:CollResultModelState,
        formArgs:CollServerArgs
    ):CollServerArgs {
        return {...formArgs, format: 'json', csortfn: state.sortFn, collpage: state.currPage};
    }

    private loadData(state:CollResultModelState, formArgs:CollServerArgs|CollSaveServerArgs):Observable<AjaxResponse> {
        const args = this.getSubmitArgs(state, formArgs);
        return this.layoutModel.ajax$<AjaxResponse>(
            HTTP.Method.GET,
            this.layoutModel.createActionUrl('collx'),
            args
        )
    }


}