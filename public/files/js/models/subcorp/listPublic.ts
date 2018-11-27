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
import RSVP from 'rsvp';

import {PageModel} from '../../app/main';
import {Action, ActionDispatcher, SEDispatcher} from '../../app/dispatcher';
import {StatelessModel} from '../base';
import { MultiDict } from '../../util';
import { Kontext } from '../../types/common';

interface LoadDataResponse extends Kontext.AjaxResponse {
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

export enum Actions {
    SET_SEARCH_TYPE = 'PUBSUBC_SET_SEARCH_TYPE',
    SET_SEARCH_QUERY = 'PUBSUBC_SET_SEARCH_QUERY',
    SET_INPUT_PREFIX_THROTTLE = 'PUBSUBC_SET_INPUT_PREFIX_THROTTLE',
    SET_CODE_PREFIX_DONE = 'PUBSUBC_SET_CODE_PREFIX_DONE',
    DATA_LOAD_DONE = 'PUBSUBC_DATA_LOAD_DONE',
    USE_IN_QUERY = 'PUBSUBC_USE_IN_QUERY'
}

export class PublicSubcorpListModel extends StatelessModel<PublicSubcorpListState> {


    queryTypeMinPrefixMapping:Immutable.Map<string, number>;

    private pageModel:PageModel;

    constructor(dispatcher:ActionDispatcher, pageModel:PageModel, data:Array<DataItem>,
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

        switch (action.actionType) {
            case Actions.SET_SEARCH_TYPE:
                newState = this.copyState(state);
                newState.searchType = action.props['value'];
                newState.minQuerySize = this.queryTypeMinPrefixMapping.get(action.props['value']);
                return newState;
            case Actions.SET_SEARCH_QUERY:
                newState = this.copyState(state);
                newState.searchQuery = action.props['value'];
                if (newState.inputPrefixThrottleTimer) {
                    window.clearTimeout(newState.inputPrefixThrottleTimer);
                }
                return newState;
            case Actions.SET_INPUT_PREFIX_THROTTLE:
                newState = this.copyState(state);
                newState.inputPrefixThrottleTimer = action.props['timerId'];
                return newState;
            case Actions.SET_CODE_PREFIX_DONE:
                newState = this.copyState(state);
                newState.isBusy = true;
                return newState;
            case Actions.DATA_LOAD_DONE:
                newState = this.copyState(state);
                newState.isBusy = false;
                newState.data = Immutable.List<DataItem>(action.props['data']['data']);
                return newState;
            default:
                return state;
        }
    }

    sideEffects(state:PublicSubcorpListState, action:Action, dispatch:SEDispatcher):void {

        switch (action.actionType) {
            case Actions.SET_SEARCH_TYPE:
            case Actions.SET_SEARCH_QUERY:
                const timerId = window.setTimeout(
                    () => {
                        if (state.searchQuery.length >= state.minQuerySize) {
                            dispatch({
                                actionType: Actions.SET_CODE_PREFIX_DONE,
                                props: {}
                            });
                        }
                        window.clearTimeout(state.inputPrefixThrottleTimer);
                    },
                    250
                );
                dispatch({
                    actionType: Actions.SET_INPUT_PREFIX_THROTTLE,
                    props: {
                        timerId: timerId
                    }
                });
            break;
            case Actions.SET_CODE_PREFIX_DONE:
                this.loadData(state).then(
                    (data) => {
                        dispatch({
                            actionType: Actions.DATA_LOAD_DONE,
                            props: {
                                data: data
                            }
                        });
                    }

                ).catch(
                    (err) => {
                        this.pageModel.showMessage('error', err);
                        dispatch({
                            actionType: Actions.DATA_LOAD_DONE,
                            props: {},
                            error: err
                        });
                    }
                );
            break;
            case Actions.USE_IN_QUERY:
                const args = new MultiDict();
                args.set('corpname', action.props['corpname']);
                args.set('usesubcorp', action.props['id']);
                window.location.href = this.pageModel.createActionUrl(
                    'first_form',
                    args
                );
            break;
        }
    }

    private loadData(state:PublicSubcorpListState):RSVP.Promise<LoadDataResponse> {
        // TODO
        const args = new MultiDict();
        args.set('format', 'json');
        args.set('query', state.searchQuery);
        args.set('search_type', state.searchType);
        args.set('offset', 0); // TODO
        args.set('limit', 20); // TODO
        return this.pageModel.ajax<LoadDataResponse>(
            'GET',
            this.pageModel.createActionUrl('subcorpus/list_published'),
            args
        );
    }

}