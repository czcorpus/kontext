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

import { Observable, throwError } from 'rxjs';
import { IActionDispatcher, StatelessModel, SEDispatcher } from 'kombo';
import { concatMap, tap, map } from 'rxjs/operators';
import { List, HTTP, tuple, pipe, Dict } from 'cnc-tskit';

import * as Kontext from '../../types/kontext';
import * as ViewOptions from '../../types/viewOptions';
import { validateGzNumber } from '../base';
import { PageModel } from '../../app/page';
import { Actions } from './actions';
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


        this.addActionHandler<typeof Actions.WordlistResultViewConc>(
            Actions.WordlistResultViewConc.name,
            null,
            (state, action, dispatch) => {
                this.suspend({}, (otherAction, syncData) => {
                    if (otherAction.name === Actions.WordlistFormSubmitReady.name) {
                        return null;
                    }
                    return {};

                }).pipe(
                    concatMap(
                        otherAction => {
                            const formArgs = (otherAction as typeof Actions.WordlistFormSubmitReady
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
                            'view',
                            {
                                q: '~' + data.conc_persistence_op_id,
                                ...data.conc_args
                            }
                        );

                    },
                    err => {
                        this.layoutModel.showMessage('error', err);
                    }
                );
            }
        );

        this.addActionHandler<typeof Actions.WordlistPageLoadDone>(
            Actions.WordlistPageLoadDone.name,
            (state, action) => {
                if (!action.error) {
                    state.currPage = action.payload.page;
                    state.currPageInput = action.payload.page + '';
                    state.data = action.payload.data;
                }
                state.isBusy = false;
            }
        );

        this.addActionHandler<typeof Actions.WordlistResultReload>(
            Actions.WordlistResultReload.name,
            null,
            (state, action, dispatch) => {
                this.processPageLoad(state, state.currPage, dispatch);
            }
        );

        this.addActionHandler<typeof Actions.WordlistResultNextPage>(
            Actions.WordlistResultNextPage.name,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.processPageLoad(state, state.currPage + 1, dispatch);
            }
        );

        this.addActionHandler<typeof Actions.WordlistResultPrevPage>(
            Actions.WordlistResultPrevPage.name,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.processPageLoad(state, state.currPage - 1, dispatch);
            }
        );

        this.addActionHandler<typeof Actions.WordlistResultSetPage>(
            Actions.WordlistResultSetPage.name,
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

        this.addActionHandler<typeof Actions.WordlistResultConfirmPage>(
            Actions.WordlistResultConfirmPage.name,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                // action.payload.page is already validated here
                this.processPageLoad(state, parseInt(action.payload.page), dispatch);
            }
        );

        this.addActionHandler<typeof Actions.WordlistGoToLastPage>(
            Actions.WordlistGoToLastPage.name,
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

        this.addActionHandler<typeof Actions.WordlistGoToFirstPage>(
            Actions.WordlistGoToFirstPage.name,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.processPageLoad(state, 1, dispatch);
            }
        );

        this.addActionHandler<typeof Actions.WordlistIntermediateBgCalcUpdated>(
            Actions.WordlistIntermediateBgCalcUpdated.name,
            (state, action) => {
                state.bgCalcStatus = action.payload.status;
                if (action.error) {
                    state.isError = true;
                }
            }
        );

        this.addActionHandler<typeof Actions.WordlistHistoryPopState>(
            Actions.WordlistHistoryPopState.name,
            (state, action) => {
                state.currPageInput = action.payload.currPageInput;
                state.currPage = parseInt(state.currPageInput);
            },
            (state, action, dispatch) => {
                this.processPageLoad(state, state.currPage, dispatch);
            }
        );

        this.addActionHandler<typeof Actions.WordlistResultSetSortColumn>(
            Actions.WordlistResultSetSortColumn.name,
            (state, action) => {
                state.wlsort = action.payload.sortKey;
                state.reversed = action.payload.reverse;
            },
            (state, action, dispatch) => {
                this.processPageLoad(state, state.currPage, dispatch);
            }
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
                dispatch<typeof Actions.WordlistPageLoadDone>({
                    name: Actions.WordlistPageLoadDone.name,
                    payload: {
                        page: newPage,
                        data
                    }
                });
            },
            (err) => {
                this.layoutModel.showMessage('error', err);
                dispatch<typeof Actions.WordlistPageLoadDone>({
                    name: Actions.WordlistPageLoadDone.name,
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
                                this.exportReloadArgs(state)
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
                Dict.toEntries({
                    q: `~${state.queryId}`,
                    wlpage: newPage,
                    wlsort: state.wlsort || undefined,
                    reversed: state.reversed,
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
        const currArgs = this.layoutModel.getConcArgs();
        const args:ConcQueryArgs = {
            type:'concQueryArgs',
            maincorp: primaryCorpus,
            usesubcorp: formSubmitArgs.usesubcorp || null,
            viewmode: 'kwic',
            pagesize: currArgs.pagesize,
            attrs: currArgs.attrs,
            attr_vmode: currArgs.attr_vmode,
            base_viewattr: currArgs.base_viewattr,
            ctxattrs: currArgs.ctxattrs,
            structs: currArgs.structs,
            refs: currArgs.refs,
            fromp: currArgs.fromp || 0,
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