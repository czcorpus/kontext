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

import * as Immutable from 'immutable';

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
    data:Immutable.List<DataItem>;
    searchQuery:string;
    minQuerySize:number;
    searchType:SearchTypes;
    inputPrefixThrottleTimer:number;
}

export class PublicSubcorpListModel extends StatelessModel<PublicSubcorpListState> {


    queryTypeMinPrefixMapping:Immutable.Map<string, number>;

    private pageModel:PageModel;

    constructor(dispatcher:IActionDispatcher, pageModel:PageModel, data:Array<DataItem>,
                minCodePrefix:number, minAuthorPrefix:number) {
        super(
            dispatcher,
            {
                isBusy: false,
                data: Immutable.List<DataItem>(data),
                searchQuery: '',
                minQuerySize: minCodePrefix,
                searchType: SearchTypes.BY_CODE,
                inputPrefixThrottleTimer: -1
            }
        );
        this.queryTypeMinPrefixMapping = Immutable.Map<string, number>({
            [SearchTypes.BY_CODE]: minCodePrefix,
            [SearchTypes.BY_AUTHOR]: minAuthorPrefix
        });
        this.pageModel = pageModel;
    }

    reduce(state:PublicSubcorpListState, action:Action):PublicSubcorpListState {
        let newState:PublicSubcorpListState;
        switch (action.name) {
            case ActionName.SetSearchType:
                newState = this.copyState(state);
                newState.searchType = action.payload['value'];
                newState.minQuerySize = this.queryTypeMinPrefixMapping.get(action.payload['value']);
                return newState;
            case ActionName.SetSearchQuery:
                newState = this.copyState(state);
                newState.searchQuery = action.payload['value'];
                if (newState.inputPrefixThrottleTimer) {
                    window.clearTimeout(newState.inputPrefixThrottleTimer);
                }
                return newState;
            case ActionName.SetInputPrefixThrottle:
                newState = this.copyState(state);
                newState.inputPrefixThrottleTimer = action.payload['timerId'];
                return newState;
            case ActionName.SetCodePrefixDone:
                newState = this.copyState(state);
                newState.isBusy = true;
                return newState;
            case ActionName.DataLoadDone:
                newState = this.copyState(state);
                newState.isBusy = false;
                newState.data = Immutable.List<DataItem>(action.payload['data']['data']);
                return newState;
            default:
                return state;
        }
    }

    sideEffects(state:PublicSubcorpListState, action:Action, dispatch:SEDispatcher):void {
        switch (action.name) {
            case ActionName.SetSearchType:
            case ActionName.SetSearchQuery:
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
            break;
            case ActionName.UseInQuery:
                const args = new MultiDict();
                args.set('corpname', action.payload['corpname']);
                args.set('usesubcorp', action.payload['id']);
                window.location.href = this.pageModel.createActionUrl(
                    'first_form',
                    args
                );
            break;
        }
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