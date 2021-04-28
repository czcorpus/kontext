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

import { Observable, of as rxOf, throwError } from 'rxjs';
import { IActionDispatcher, StatelessModel, SEDispatcher } from 'kombo';
import { concatMap, tap, map } from 'rxjs/operators';
import { List, HTTP, tuple, pipe, Dict } from 'cnc-tskit';

import { Kontext, ViewOptions } from '../../types/common';
import { validateGzNumber } from '../base';
import { PageModel } from '../../app/page';
import { MultiDict } from '../../multidict';
import { ActionName, Actions } from './actions';
import { ResultItem, IndexedResultItem, HeadingItem, ResultData, WordlistSubmitArgs } from './common';
import { ConcQueryArgs } from '../query/common';
import { ConcQueryResponse } from '../concordance/common';



export interface DataAjaxResponse extends Kontext.AjaxResponse {
    data:Array<ResultItem>;
    total:number;
    query_id:string;
    wlattr_label:string;
    wlsort:string;
    reversed:boolean;
    wlpagesize:number;
    wlpage:number;
    quick_save_row_limit:number;
    freq_figure:string;
}


export interface WlSizeAjaxResponse extends Kontext.AjaxResponse {
    size:number;
}


export interface WordlistResultModelState {

    queryId:string;

    corpname:string;

    usesubcorp:string;

    wlsort:string;

    reversed:boolean;

    data:Array<IndexedResultItem>;

    total:number;

    headings:Array<HeadingItem>;

    currPage:number;

    currPageInput:string;

    pageSize:number;

    numPages:number;

    isBusy:boolean;

    isUnfinished:boolean;

    bgCalcStatus:number; // per-cent value

    isError:boolean;
}


function importData(
    data:Array<ResultItem>,
    currPage:number,
    pageSize:number
):Array<IndexedResultItem> {
    return List.map(
        ([str, freq], i) => ({
            freq,
            str,
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

    constructor(
        dispatcher:IActionDispatcher,
        layoutModel:PageModel,
        data:ResultData,
        headings:Array<HeadingItem>,
        isUnfinished:boolean
    ) {
        super(
            dispatcher,
            {
                queryId: data.queryId,
                corpname: data.corpname,
                usesubcorp: data.usesubcorp,
                wlsort: data.wlsort,
                reversed: data.reversed,
                currPage: data.page,
                currPageInput: data.page + '',
                pageSize: data.pageSize,
                data: importData(data.data, data.page, data.pageSize),
                total: data.total,
                headings: [...headings],
                isBusy: false,
                numPages: Math.ceil(data.total / data.pageSize),
                isUnfinished,
                bgCalcStatus: 0,
                isError: false
            }
        );
        this.layoutModel = layoutModel;


        this.addActionHandler<Actions.WordlistResultViewConc>(
            ActionName.WordlistResultViewConc,
            null,
            (state, action, dispatch) => {
                this.suspend({}, (otherAction, syncData) => {
                    if (otherAction.name === ActionName.WordlistFormSubmitReady) {
                        return null;
                    }
                    return {};

                }).pipe(
                    concatMap(
                        otherAction => {
                            const formArgs = (otherAction as Actions.WordlistFormSubmitReady
                                ).payload.args;
                            return this.layoutModel.ajax$<ConcQueryResponse>(
                                HTTP.Method.POST,
                                this.layoutModel.createActionUrl(
                                    'query_submit', [tuple('format', 'json')]),
                                    this.createConcSubmitArgs(state, formArgs, action.payload.word),
                                {
                                    contentType: 'application/json'
                                }
                            );
                        }
                    )
                ).subscribe(
                    (data:ConcQueryResponse) => {
                        window.location.href = this.layoutModel.createActionUrl(
                            'view', [
                                ['q', '~' + data.conc_persistence_op_id],
                                ...pipe(
                                    data.conc_args,
                                    Dict.toEntries()
                                )
                            ]
                        );

                    },
                    err => {
                        this.layoutModel.showMessage('error', err);
                    }
                );
            }
        );

        this.addActionHandler<Actions.WordlistPageLoadDone>(
            ActionName.WordlistPageLoadDone,
            (state, action) => {
                if (!action.error) {
                    state.currPage = action.payload.page;
                    state.currPageInput = action.payload.page + '';
                    state.data = action.payload.data;
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
                state.isBusy = true;
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
                state.currPage = state.numPages;
                state.currPageInput = `${state.numPages}`;
            },
            (state, action, dispatch) => {
                this.processPageLoad(
                    state,
                    state.currPage,
                    dispatch
                )
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

        this.addActionHandler<Actions.WordlistIntermediateBgCalcUpdated>(
            ActionName.WordlistIntermediateBgCalcUpdated,
            (state, action) => {
                state.bgCalcStatus = action.payload.status;
                if (action.error) {
                    state.isError = true;
                }
            }
        );

        this.addActionHandler<Actions.WordlistHistoryPopState>(
            ActionName.WordlistHistoryPopState,
            (state, action) => {
                state.currPageInput = action.payload.currPageInput;
                state.currPage = parseInt(state.currPageInput);
            },
            (state, action, dispatch) => {
                this.processPageLoad(state, state.currPage, dispatch);
            }
        );

        this.addActionHandler<Actions.WordlistResultSetSortColumn>(
            ActionName.WordlistResultSetSortColumn,
            (state, action) => {
                state.wlsort = action.payload.sortKey;
            },
            (state, action, dispatch) => {
                this.processPageLoad(state, state.currPage, dispatch);
            }
        );
    }

    private fetchLastPage(
        state:WordlistResultModelState
    ):Observable<[Array<IndexedResultItem>, number]> {
        return this.pageLoad(state, state.numPages).pipe(
            map(
                ([data, pageNum]) => tuple(
                    data, pageNum
                )
            )
        );
    }

    private createPQuery(s:string, wlattr:string):string {
        return `[${wlattr}="${s.replace(/([.?+*\[\]{}$^|])/g, '\\$1')}"]`;
    }

    private exportReloadArgs(state:WordlistResultModelState):Array<[string, string|number]> {
        return [
            tuple('q', `~${state.queryId}`),
            tuple('wlpage', state.currPage.toString()),
            tuple('wlsort', state.wlsort)
        ];
    }

    private processPageLoad(
        state:WordlistResultModelState,
        newPage:number,
        dispatch:SEDispatcher,
        skipHistory=false
    ):void {
        this.pageLoad(state, newPage, skipHistory).subscribe(
            ([data, total]) => {
                dispatch<Actions.WordlistPageLoadDone>({
                    name: ActionName.WordlistPageLoadDone,
                    payload: {
                        page: newPage,
                        data
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

    private pageLoad(
        state:WordlistResultModelState,
        newPage:number,
        skipHistory=false
    ):Observable<[Array<IndexedResultItem>, number]> {
        return newPage < 1 || newPage > state.numPages ?
            throwError(new Error(this.layoutModel.translate('wordlist__page_not_found_err'))) :
            this.loadData(state, newPage).pipe(
                tap(
                    () => {
                        if (!skipHistory) {
                            this.layoutModel.getHistory().pushState(
                                'wordlist/result',
                                new MultiDict(this.exportReloadArgs(state))
                            );
                        }
                    }
                )
            );
    }


    /**
     *
     * @return Observable of tuple (data, total num of items)
     */
    private loadData(
        state:WordlistResultModelState,
        newPage:number
    ):Observable<[Array<IndexedResultItem>, number]> {
        return this.layoutModel.ajax$<DataAjaxResponse>(
            HTTP.Method.GET,
            this.layoutModel.createActionUrl(
                'wordlist/result',
                MultiDict.fromDict({
                    q: `~${state.queryId}`,
                    wlpage: newPage,
                    wlsort: state.wlsort || undefined,
                    format: 'json'
                })
            ),
            {}

        ).pipe(
            map(
                data => tuple(
                    importData(data.data, newPage, state.pageSize),
                    data.total,
                )
            )
        );
    }

    private createConcSubmitArgs(
        state:WordlistResultModelState,
        formSubmitArgs:WordlistSubmitArgs,
        word:string
    ):ConcQueryArgs {
        const primaryCorpus = formSubmitArgs.corpname;
        const currArgs = this.layoutModel.exportConcArgs();
        const args:ConcQueryArgs = {
            type:'concQueryArgs',
            maincorp: primaryCorpus,
            usesubcorp: formSubmitArgs.usesubcorp || null,
            viewmode: 'kwic',
            pagesize: parseInt(currArgs.head('pagesize')),
            attrs: currArgs.getList('attrs'),
            attr_vmode: currArgs.head('attr_vmode') as ViewOptions.AttrViewMode,
            base_viewattr: currArgs.head('base_viewattr'),
            ctxattrs: currArgs.getList('ctxattrs'),
            structs: currArgs.getList('structs'),
            refs: currArgs.getList('refs'),
            fromp: parseInt(currArgs.head('fromp') || '0'),
            shuffle: 0,
            queries: [
                {
                    corpname: formSubmitArgs.corpname,
                    query: this.createPQuery(word, formSubmitArgs.wlattr),
                    qtype: 'advanced',
                    pcq_pos_neg: 'pos',
                    include_empty: false,
                    default_attr: formSubmitArgs.wlattr
                }
            ],
            async: true,
            text_types: {},
            context: {
                fc_lemword_wsize: [0, 0],
                fc_lemword: ''  ,
                fc_lemword_type: 'none',
                fc_pos_wsize: [0, 0],
                fc_pos: [],
                fc_pos_type: 'none'
            }
        };
        return args;
    }
}