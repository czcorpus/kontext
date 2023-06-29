/*
 * Copyright (c) 2023 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2023 Tomas Machalek <tomas.machalek@gmail.com>
 * Copyright (c) 2023 Martin Zimandl <martin.zimandl@gmail.com>
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

import * as Kontext from '../../types/kontext';
import { IActionDispatcher, SEDispatcher, StatelessModel } from 'kombo';
import { PageModel } from '../../app/page';
import { Keyword } from './common';
import { Actions } from './actions';
import { validateGzNumber } from '../base';
import { Observable, tap, throwError } from 'rxjs';
import { HTTP } from 'cnc-tskit';



export interface KeywordsResultState {
    data:Array<Keyword>;
    isBusy:boolean;
    refCorpname:string;
    refSubcorpname:string|undefined;
    focusCorpname:string;
    focusSubcorpname:string|undefined;
    total:number;
    kwpage:number;
    kwpagesize:number;
    kwsort:string;
    totalPages:number;
    queryId:string;
    isLoading:boolean;
}

export interface KeywordsResultModelArgs {
    dispatcher:IActionDispatcher;
    layoutModel:PageModel;
    refCorpname:string;
    refSubcorpname:string|undefined;
    focusCorpname:string;
    focusSubcorpname:string|undefined;
}

export interface DataAjaxResponse extends Kontext.AjaxResponse {
    data:Array<Keyword>;
    total:number;
    query_id:string;
    kwpagesize:number;
    kwpage:number;
    kwsort:string;
}

/**
 *
 */
export class KeywordsResultModel extends StatelessModel<KeywordsResultState> {

    private readonly layoutModel:PageModel;

    constructor({
        dispatcher,
        layoutModel,
        refCorpname,
        refSubcorpname,
        focusCorpname,
        focusSubcorpname
    }:KeywordsResultModelArgs) {
        super(
            dispatcher,
            {
                data: layoutModel.getConf<Array<Keyword>>('Keywords'),
                isBusy: false,
                refCorpname,
                refSubcorpname,
                focusCorpname,
                focusSubcorpname,
                kwpage: layoutModel.getConf<number>('Page'),
                kwpagesize: layoutModel.getConf<number>('PageSize'),
                kwsort: layoutModel.getConf<string>('Sort'),
                total: layoutModel.getConf<number>('Total'),
                totalPages: Math.ceil(layoutModel.getConf<number>('Total')/layoutModel.getConf<number>('PageSize')),
                queryId: layoutModel.getConf<string>('QueryId'),
                isLoading: false,
            }
        );
        this.layoutModel = layoutModel;

        this.addActionHandler(
            Actions.ResultSetPage,
            (state, action) => {
                if (validateGzNumber(action.payload.page)) {
                    if (parseInt(action.payload.page) > state.totalPages) {
                        state.kwpage = state.totalPages;
                        this.layoutModel.showMessage('info', this.layoutModel.translate('global__no_more_pages'));
                    } else {
                        state.kwpage = parseInt(action.payload.page);
                    }
                    state.isLoading = true;
                } else {
                    this.layoutModel.showMessage('error', this.layoutModel.translate('freq__page_invalid_val'));
                }
            },
            (state, action, dispatch) => {
                this.processPageLoad(state, dispatch, false);
            }
        );

        this.addActionHandler(
            Actions.KeywordsHistoryPopState,
            (state, action) => {
                state.kwpage = action.payload.kwpage;
                state.kwsort = action.payload.kwsort;
                state.queryId = action.payload.q;
            },
            (state, action, dispatch) => {
                this.processPageLoad(state, dispatch, true);
            }
        );

        this.addActionHandler(
            Actions.ResultPageLoadDone,
            (state, action) => {
                state.isLoading = false;
                if (!action.error) {
                    state.data = action.payload.data;
                    state.kwpage = action.payload.page;
                    state.kwsort = action.payload.sort;
                }
            }
        );
    }

    private processPageLoad(
        state:KeywordsResultState,
        dispatch:SEDispatcher,
        skipHistory=false
    ):void {
        this.pageLoad(state, skipHistory).subscribe({
            next: resp => {
                dispatch<typeof Actions.ResultPageLoadDone>({
                    name: Actions.ResultPageLoadDone.name,
                    payload: {
                        page: resp.kwpage,
                        sort: resp.kwsort,
                        data: resp.data,
                    }
                });
            },
            error: error => {
                this.layoutModel.showMessage('error', error);
                dispatch<typeof Actions.ResultPageLoadDone>({
                    name: Actions.ResultPageLoadDone.name,
                    error,
                });
            }
        });
    }

    private pageLoad(state:KeywordsResultState, skipHistory=false):Observable<DataAjaxResponse> {
        return this.loadData(state).pipe(
            tap(
                () => {
                    if (!skipHistory) {
                        this.layoutModel.getHistory().pushState(
                            'keywords/result',
                            {
                                q: `~${state.queryId}`,
                                kwpage: state.kwpage,
                                kwsort: state.kwsort,
                            },
                            {
                                q: `~${state.queryId}`,
                                kwpage: state.kwpage,
                                kwsort: state.kwsort,
                            }
                        );
                    }
                }
            )
        );
    }

    private loadData(state:KeywordsResultState):Observable<DataAjaxResponse> {
        return this.layoutModel.ajax$<DataAjaxResponse>(
            HTTP.Method.GET,
            this.layoutModel.createActionUrl(
                'keywords/result',
                {
                    q: `~${state.queryId}`,
                    kwpage: state.kwpage,
                    kwsort: state.kwsort,
                    format: 'json',
                }
            ),
            {}
        );
    }

}