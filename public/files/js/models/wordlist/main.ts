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

import { Observable, of as rxOf } from 'rxjs';
import { IActionDispatcher, StatelessModel, SEDispatcher } from 'kombo';
import { concatMap, tap, map, skip } from 'rxjs/operators';

import { Kontext } from '../../types/common';
import { validateGzNumber } from '../base';
import { PageModel } from '../../app/page';
import { WordlistFormModel } from './form';
import { MultiDict } from '../../multidict';
import { ActionName, Actions } from './actions';
import { List, HTTP, tuple } from 'cnc-tskit';
import { ResultItem, IndexedResultItem, HeadingItem, ResultData } from './common';



export interface DataAjaxResponse extends Kontext.AjaxResponse {
    Items:Array<ResultItem>;
    lastpage:number; // 0 = no, 1 = yes
}


export interface WlSizeAjaxResponse extends Kontext.AjaxResponse {
    size:number;
}


export interface WordlistResultModelState {

    data:Array<IndexedResultItem>;

    headings:Array<HeadingItem>;

    currPage:number;

    currPageInput:string;

    pageSize:number;

    isLastPage:boolean;

     /*
      * this is not obtained automatically as a
      * respective Manatee result object does not
      * provide this. We fetch this by user's
      * explicit request (when going to the last page)
      */
    numItems:number;

    isBusy:boolean;

    isUnfinished:boolean;

    bgCalcStatus:number; // per-cent value

    isError:boolean;

    reloadArgs:Kontext.ListOfPairs;
}


function importData(data:Array<ResultItem>, currPage:number, pageSize:number):Array<IndexedResultItem> {
    return List.map(
        (item, i) => ({
            freq: item.freq,
            str: item.str,
            idx: (currPage - 1) * pageSize + i
        }),
        data
    );
}


/**
 *
 */
export class WordlistResultModel extends StatelessModel<WordlistResultModelState> {

    private readonly layoutModel:PageModel;

    private readonly formModel:WordlistFormModel;

    constructor(dispatcher:IActionDispatcher, layoutModel:PageModel, formModel:WordlistFormModel,
            data:ResultData, headings:Array<HeadingItem>, reloadArgs:Kontext.ListOfPairs, isUnfinished:boolean) {
        super(
            dispatcher,
            {
                currPage: data.page,
                currPageInput: data.page + '',
                pageSize: data.pageSize,
                isLastPage: data.isLastPage,
                data: importData(data.data, data.page, data.pageSize),
                headings: [...headings],
                isBusy: false,
                numItems: null,
                isUnfinished: isUnfinished,
                bgCalcStatus: 0,
                isError: false,
                reloadArgs: reloadArgs
            }
        );
        this.layoutModel = layoutModel;
        this.formModel = formModel;

        /* TODO !!!
        this.layoutModel.getHistory().setOnPopState((evt:PopStateEvent) => {
            if (evt.state['pagination']) {
                this.currPage = evt.state['page'];
                this.currPageInput = evt.state['page'].toFixed();
                this.processPageLoad(true);
            }
        });
        */

        this.addActionHandler<Actions.WordlistResultViewConc>(
            ActionName.WordlistResultViewConc,
            null,
            (state, action, dispatch) => {
                this.suspend({}, (otherAction, syncData) => {
                    if (otherAction.name === ActionName.WordlistFormSubmitReady) {
                        return null;
                    }
                    return {};

                }).subscribe(
                    otherAction => {
                        const formArgs = (otherAction as Actions.WordlistFormSubmitReady).payload.args;
                        const args = new MultiDict();
                        args.set('corpname', formArgs.head('corpname'));
                        args.set('usesubcorp', formArgs.head('usesubcorp'));
                        args.set('default_attr', formArgs.head('wlattr'));
                        args.set('qmcase', '1');
                        args.set('queryselector', 'cqlrow');
                        args.set('cql', this.createPQuery(action.payload.word, formArgs.head('wlattr')));
                        window.location.href = this.layoutModel.createActionUrl('first', args.items());
                    },
                    err => {
                        this.layoutModel.showMessage('error', err);
                    }
                )
            }
        );

        this.addActionHandler<Actions.WordlistPageLoadDone>(
            ActionName.WordlistPageLoadDone,
            (state, action) => {
                if (!action.error) {
                    state.currPage = action.payload.page;
                    state.currPageInput = action.payload.page + '';
                }
                state.isBusy = false;
            }
        );

        this.addActionHandler<Actions.WordlistResultReload>(
            ActionName.WordlistResultReload,
            null,
            (state, action, dispatch) => {
                this.processPageLoad(state, state.currPage, dispatch);
            }
        );

        this.addActionHandler<Actions.WordlistResultNextPage>(
            ActionName.WordlistResultNextPage,
            (state, action) => {
                if (!state.isLastPage) {
                    state.isBusy = true;
                }
            },
            (state, action, dispatch) => {
                this.processPageLoad(state, state.currPage + 1, dispatch);
            }
        );

        this.addActionHandler<Actions.WordlistResultPrevPage>(
            ActionName.WordlistResultPrevPage,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.processPageLoad(state, state.currPage - 1, dispatch);
            }
        );

        this.addActionHandler<Actions.WordlistResultSetPage>(
            ActionName.WordlistResultSetPage,
            (state, action) => {
                if (validateGzNumber(action.payload.page)) {
                    state.currPageInput = action.payload.page;
                }
            },
            (state, action, dispatch) => {
                if (!validateGzNumber(action.payload.page)) {
                    this.layoutModel.showMessage('error',
                            this.layoutModel.translate('wordlist__invalid_page_num'));
                }
            }
        );

        this.addActionHandler<Actions.WordlistResultConfirmPage>(
            ActionName.WordlistResultConfirmPage,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                // action.payload.page is already validated here
                this.processPageLoad(state, parseInt(action.payload.page), dispatch);
            }
        );

        this.addActionHandler<Actions.WordlistGoToLastPage>(
            ActionName.WordlistGoToLastPage,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.suspend({}, (action, syncData) => {
                    if (action.name === ActionName.WordlistFormSubmitReady) {
                        return null;
                    }
                    return {};

                }).pipe(
                    concatMap(
                        action => {
                            const formArgs = (action as Actions.WordlistFormSubmitReady).payload.args;
                            return this.fetchLastPage(state, formArgs);
                        }
                    )
                ).subscribe(
                    ([data, pageNum, isLastPage, size]) => {
                        dispatch<Actions.WordlistPageLoadDone>({
                            name: ActionName.WordlistPageLoadDone,
                            payload: {
                                page: pageNum,
                                isLast: isLastPage,
                                newNumOfItems: size,
                                data: data
                            }
                        });
                    },
                    (err) => {
                        this.layoutModel.showMessage('error', err);
                        dispatch<Actions.WordlistPageLoadDone>({
                            name: ActionName.WordlistPageLoadDone,
                            error: err
                        });
                    }
                );
            }
        );

        this.addActionHandler<Actions.WordlistGoToFirstPage>(
            ActionName.WordlistGoToFirstPage,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.processPageLoad(state, 1, dispatch);
            }
        );

        this.addActionHandler(
            'WORDLIST_IMTERMEDIATE_BG_CALC_UPDATED',
            (state, action) => {
                state.bgCalcStatus = action.payload['status'];
                if (action.error) {
                    state.isError = true;
                }
            }
        );
    }

    private fetchLastPage(state:WordlistResultModelState, formSubmitArgs:MultiDict):Observable<[Array<IndexedResultItem>, number, boolean, number]> {
        return (() => {
            if (state.numItems === null) {
                return this.layoutModel.ajax$<WlSizeAjaxResponse>(
                    HTTP.Method.GET,
                    this.layoutModel.createActionUrl('wordlist/ajax_get_wordlist_size'),
                    formSubmitArgs
                );

            } else {
                return rxOf({
                        messages: [],
                        size: state.numItems
                });
            }
        })().pipe(
            map(
                data => tuple(
                    data.size,
                    ~~Math.ceil(state.numItems / state.pageSize)
                )
            ),
            concatMap(
                ([size, numPages]) => {
                    return this.pageLoad(state, numPages).pipe(
                        map(
                            ([data, pageNum, isLast]) => tuple(
                                data, pageNum, isLast, size
                            )
                        )
                    )
                }
            )
        );
    }

    private createPQuery(s:string, wlattr:string):string {
        return `[${wlattr}="${s.replace(/([.?+*\[\]{}$^|])/g, '\\$1')}"]`;
    }

    private pageLoad(state:WordlistResultModelState, newPage:number, skipHistory=false):Observable<[Array<IndexedResultItem>, number, boolean]> {
        return this.suspend({}, (action, syncData) => {
            if (action.name === ActionName.WordlistFormSubmitReady) {
                return null;
            }
            return {};
        }).pipe(
            concatMap(
                action => {
                    if (newPage < 1) {
                        throw new Error(this.layoutModel.translate('wordlist__page_not_found_err'));
                    }
                    const args = (action as Actions.WordlistFormSubmitReady).payload.args;
                    return this.loadData(state, newPage, args);
                }
            ),
            tap(
                data => {
                    if (!skipHistory) {
                        this.layoutModel.getHistory().pushState(
                            'wordlist/result',
                            new MultiDict(state.reloadArgs.concat([['wlpage', state.currPage.toString()]])),
                            {
                                pagination: true,
                                page: state.currPage
                            }
                        );
                    }
                }
            )
        );
    }

    private processPageLoad(state:WordlistResultModelState, newPage:number, dispatch:SEDispatcher, skipHistory=false):void {
        this.pageLoad(state, newPage, skipHistory).subscribe(
            ([data, pageNum, isLastPage]) => {
                dispatch<Actions.WordlistPageLoadDone>({
                    name: ActionName.WordlistPageLoadDone,
                    payload: {
                        page: pageNum,
                        isLast: isLastPage,
                        data: data
                    }
                });
            },
            (err) => {
                this.layoutModel.showMessage('error', err);
                dispatch<Actions.WordlistPageLoadDone>({
                    name: ActionName.WordlistPageLoadDone,
                    error: err
                });
            }
        );
    }

    private loadData(state:WordlistResultModelState, newPage:number, formModelSubmitArgs:MultiDict):Observable<[Array<IndexedResultItem>, number, boolean]> {
        formModelSubmitArgs.set('wlpage', state.currPage);
        return this.layoutModel.ajax$<DataAjaxResponse>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl('wordlist/result', [['format', 'json']]),
            formModelSubmitArgs

        ).pipe(
            concatMap(
                (data) => {
                    if (data.lastpage && data.Items.length === 0) {
                        throw new Error(this.layoutModel.translate('wordlist__page_not_found_err'));
                    }
                    return rxOf(tuple(
                        importData(data.Items, state.currPage, state.pageSize),
                        newPage,
                        !!data.lastpage
                    ));
                }
            )
        );
    }
}