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
import { MultiDict } from '../../multidict';
import { Actions, ActionName } from './actions';
import { HTTP, List } from 'cnc-tskit';
import { CollResultData, CollResultHeading, CollResultRow, CollResultHeadingCell, AjaxResponse, CollServerArgs, HistoryState, CollSaveServerArgs } from './common';
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
                dispatcher.dispatch<Actions.ResultUpdateCalculation>({
                    name: ActionName.ResultUpdateCalculation,
                    payload: {
                        calcStatus: status
                    }
                });

            } else {
                this.calcWatchdog.stopWatching();
                dispatcher.dispatch<Actions.ResultUpdateCalculation>({
                    name: ActionName.ResultUpdateCalculation,
                    payload: {
                        calcStatus: 1000
                    },
                    error: err
                });
                if (status >= 100) {
                    dispatcher.dispatch<Actions.ResultReload>({
                        name: ActionName.ResultReload
                    });
                }
            }
        });
        if (unfinished) {
            this.calcWatchdog.startWatching();
        }

        this.addActionHandler<Actions.ResultReload>(
            ActionName.ResultReload,
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

        this.addActionHandler<Actions.ResultUpdateCalculation>(
            ActionName.ResultUpdateCalculation,
            (state, action) => {
                state.calcStatus = action.payload.calcStatus;
            },
            (state, action, dispatch) => {
                if (action.error) {
                    this.layoutModel.showMessage('error', action.error);
                }
            }
        );

        this.addActionHandler<Actions.ResultSetPageInputVal>(
            ActionName.ResultSetPageInputVal,
            (state, action) => {
                state.currPageInput = action.payload.value;
            },
            (state, action, dispatch) => {
                if (!validateGzNumber(state.currPageInput)) {
                    this.layoutModel.showMessage('error', this.layoutModel.translate('concview__invalid_page_num_err'));
                }
            }
        );

        this.addActionHandler<Actions.ResultGetNextPage>(
            ActionName.ResultGetNextPage,
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

        this.addActionHandler<Actions.ResultGetPrevPage>(
            ActionName.ResultGetPrevPage,
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

        this.addActionHandler<Actions.ResultConfirmPageValue>(
            ActionName.ResultConfirmPageValue,
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

        this.addActionHandler<Actions.ResultPageLoadDone>(
            ActionName.ResultPageLoadDone,
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

        this.addActionHandler<Actions.ResultSortByColumn>(
            ActionName.ResultSortByColumn,
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

        this.addActionHandler<Actions.ResultApplyQuickFilter>(
            ActionName.ResultApplyQuickFilter,
            (state, action) => {

            },
            (state, action, dispatch) => {
                this.applyQuickFilter(action.payload.args, action.payload.blankWindow);
            }
        );

        this.addActionHandler<Actions.StatePushToHistory>(
            ActionName.StatePushToHistory,
            (state, action) => {
                this.pushStateToHistory(state, action.payload);
            }
        );

        this.addActionHandler<Actions.PopHistory>(
            ActionName.PopHistory,
            (state, action) => {
                state.currPage = action.payload.page;
                state.currPageInput = `${action.payload.page}`
                state.sortFn = action.payload.sort;
                state.isWaiting = true;
            },
            (state, action, dispatch) => {
                this.dispatchLoad(
                    this.processDataReload(state),
                    dispatch,
                    false
                );
            }
        );
    }

    private applyQuickFilter(args:Array<[keyof ConcQuickFilterServerArgs, ConcQuickFilterServerArgs[keyof ConcQuickFilterServerArgs]]>, blankWindow:boolean) {
        const submitArgs = this.layoutModel.exportConcArgs() as MultiDict<ConcQuickFilterServerArgs>;
        submitArgs.remove('q2');
        args.forEach(item => submitArgs.add(item[0], item[1]));
        this.layoutModel.setLocationPost(this.layoutModel.createActionUrl('quick_filter', submitArgs.items()), [], blankWindow);
    }

    private processDataReload(state:CollResultModelState):Observable<[AjaxResponse, MultiDict<CollSaveServerArgs>]> {
        return this.suspend({}, (action, syncData) => {
            if (action.name === ActionName.FormPrepareSubmitArgsDone) {
                return null;
            }
            return syncData;

        }).pipe(
            concatMap(
                action => {
                    const payload = (action as Actions.FormPrepareSubmitArgsDone).payload;
                    return forkJoin([this.loadData(state, payload.args), of(payload.args)]);
                }
            )
        );
    }

    private dispatchLoad(
        load:Observable<[AjaxResponse, MultiDict<CollSaveServerArgs>]>,
        dispatch:SEDispatcher,
        pushHistory:boolean
    ):void {

        load.subscribe(
            ([data, args]) => {
                if (data.Items.length === 0) {
                    this.layoutModel.showMessage('info', this.layoutModel.translate('global__no_more_pages'));
                }
                dispatch<Actions.ResultPageLoadDone>({
                    name: ActionName.ResultPageLoadDone,
                    payload: {
                        response: data
                    }
                });
                if (pushHistory) {
                    dispatch<Actions.StatePushToHistory>({
                        name: ActionName.StatePushToHistory,
                        payload: args
                    });
                }
            },
            (err) => {
                dispatch<Actions.ResultPageLoadDone>({
                    name: ActionName.ResultPageLoadDone,
                    error: err
                });
            }
        );
    }

    private pushStateToHistory(state:CollResultModelState, formArgs:MultiDict<CollServerArgs>):void {
        formArgs.remove('format');
        const hstate:HistoryState = {
            page: state.currPage,
            sort: state.sortFn
        };
        this.layoutModel.getHistory().pushState(
            'collx',
            formArgs,
            hstate,
            window.document.title
        );
    }

    private getSubmitArgs(state:CollResultModelState, formArgs:MultiDict<CollServerArgs>):MultiDict<CollServerArgs> {
        formArgs.set('format', 'json');
        formArgs.set('csortfn', state.sortFn);
        formArgs.set('collpage', state.currPage);
        return formArgs;
    }

    private loadData(state:CollResultModelState, formArgs:MultiDict<CollServerArgs>):Observable<AjaxResponse> {
        const args = this.getSubmitArgs(state, formArgs);
        return this.layoutModel.ajax$<AjaxResponse>(
            HTTP.Method.GET,
            this.layoutModel.createActionUrl('collx'),
            args
        )
    }


}