/*
 * Copyright (c) 2018 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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

import {PageModel} from '../../app/page';
import { MultiDict } from '../../multidict';
import { Kontext } from '../../types/common';
import { StatelessModel, IActionDispatcher, Action, SEDispatcher } from 'kombo';
import { Observable } from 'rxjs';
import { ActionName, Actions } from './actions';

export interface LoadDataResponse extends Kontext.AjaxResponse {
    data:Array<DataItem>;
    corpora:Array<CorpusItem>;
}

export interface DataItem {
    ident:string;
    origName:string;
    corpname:string;
    author:string;
    description:string;
    userId:number;
}

export interface CorpusItem {
    ident:string;
    label:string;
}

export enum SearchTypes {
    BY_CODE = 'code',
    BY_AUTHOR = 'author'
}

export interface PublicSubcorpListState {
    isBusy:boolean;
    data:Array<DataItem>;
    searchQuery:string;
    minQuerySize:number;
    searchType:SearchTypes;
    inputPrefixThrottleTimer:number;
}

export class PublicSubcorpListModel extends StatelessModel<PublicSubcorpListState> {

    queryTypeMinPrefixMapping:{[key:string]:number};

    private pageModel:PageModel;

    constructor(dispatcher:IActionDispatcher, pageModel:PageModel, data:Array<DataItem>,
                minCodePrefix:number, minAuthorPrefix:number) {
        super(
            dispatcher,
            {
                isBusy: false,
                data: data,
                searchQuery: '',
                minQuerySize: minCodePrefix,
                searchType: SearchTypes.BY_CODE,
                inputPrefixThrottleTimer: -1
            }
        );
        this.queryTypeMinPrefixMapping = {
            [SearchTypes.BY_CODE]: minCodePrefix,
            [SearchTypes.BY_AUTHOR]: minAuthorPrefix
        };
        this.pageModel = pageModel;

        this.addActionHandler<Actions.SetSearchType>(
            ActionName.SetSearchType,
            (state, action) => {
                state.searchType = action.payload.value;
                state.minQuerySize = this.queryTypeMinPrefixMapping[action.payload.value];
            },
            this.setSearch
        );

        this.addActionHandler<Actions.SetSearchQuery>(
            ActionName.SetSearchQuery,
            (state, action) => {
                state.searchQuery = action.payload.value;
                if (state.inputPrefixThrottleTimer) {
                    window.clearTimeout(state.inputPrefixThrottleTimer);
                }
            },
            this.setSearch
        );

        this.addActionHandler<Actions.SetInputPrefixThrottle>(
            ActionName.SetInputPrefixThrottle,
            (state, action) => {
                state.inputPrefixThrottleTimer = action.payload.timerId;
            }
        );

        this.addActionHandler<Actions.SetCodePrefixDone>(
            ActionName.SetCodePrefixDone,
            (state, action) => {
                state.isBusy = true;
            }
        );

        this.addActionHandler<Actions.DataLoadDone>(
            ActionName.DataLoadDone,
            (state, action) => {
                state.isBusy = false;
                state.data = action.payload.data.data;
            }
        );

        this.addActionHandler<Actions.UseInQuery>(
            ActionName.UseInQuery,
            null,
            (state, action, dispatch) => {
                const args = new MultiDict();
                args.set('corpname', action.payload.corpname);
                args.set('usesubcorp', action.payload.id);
                window.location.href = this.pageModel.createActionUrl(
                    'first_form',
                    args
                );
            }

        );
    }

    private setSearch(state:PublicSubcorpListState, action:Action, dispatch:SEDispatcher):void {
        const timerId = window.setTimeout(
            () => {
                if (state.searchQuery.length >= state.minQuerySize) {
                    dispatch<Actions.SetCodePrefixDone>({
                        name: ActionName.SetCodePrefixDone,
                        payload: {}
                    });
                    this.loadData(state).subscribe(
                        (data) => {
                            dispatch<Actions.DataLoadDone>({
                                name: ActionName.DataLoadDone,
                                payload: {
                                    data: data
                                }
                            });
                        },
                        (err) => {
                            this.pageModel.showMessage('error', err);
                            dispatch<Actions.DataLoadDone>({
                                name: ActionName.DataLoadDone,
                                error: err
                            });
                        }
                    );
                }
                window.clearTimeout(state.inputPrefixThrottleTimer);
            },
            250
        );
        dispatch<Actions.SetInputPrefixThrottle>({
            name: ActionName.SetInputPrefixThrottle,
            payload: {
                timerId: timerId
            }
        });
    }

    private loadData(state:PublicSubcorpListState):Observable<LoadDataResponse> {
        // TODO
        const args = new MultiDict();
        args.set('format', 'json');
        args.set('query', state.searchQuery);
        args.set('search_type', state.searchType);
        args.set('offset', 0); // TODO
        args.set('limit', 20); // TODO
        return this.pageModel.ajax$<LoadDataResponse>(
            'GET',
            this.pageModel.createActionUrl('subcorpus/list_published'),
            args
        );
    }

}