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
import { StatelessModel, IActionDispatcher } from 'kombo';
import { Observable, Subject } from 'rxjs';
import { Actions } from './actions';
import { HTTP } from 'cnc-tskit';
import { debounceTime } from 'rxjs/operators';


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
    created:number;
}

export interface CorpusItem {
    ident:string;
    label:string;
}

export interface PublicSubcorpListState {
    isBusy:boolean;
    data:Array<DataItem>;
    searchQuery:string;
    minQuerySize:number;
}

export class PublicSubcorpListModel extends StatelessModel<PublicSubcorpListState> {

    queryTypeMinPrefixMapping:{[key:string]:number};

    private pageModel:PageModel;

    private autoSubmitTrigger:Subject<string>;

    constructor(dispatcher:IActionDispatcher, pageModel:PageModel, data:Array<DataItem>, minQuerySize:number) {
        super(
            dispatcher,
            {
                isBusy: false,
                data,
                searchQuery: '',
                minQuerySize
            }
        );
        this.autoSubmitTrigger = new Subject<string>();
        this.autoSubmitTrigger.pipe(
            debounceTime(300)

        ).subscribe(
            query => {
                dispatcher.dispatch<typeof Actions.SubmitSearchQuery>({
                    name: Actions.SubmitSearchQuery.name,
                    payload: {
                        query
                    }
                });
            },
            (err) => {
                this.pageModel.showMessage('error', err);
                dispatcher.dispatch<typeof Actions.SubmitSearchQuery>({
                    name: Actions.SubmitSearchQuery.name,
                    error: err
                });
            }
        );

        this.pageModel = pageModel;

        this.addActionHandler<typeof Actions.SetSearchQuery>(
            Actions.SetSearchQuery.name,
            (state, action) => {
                state.searchQuery = action.payload.value;
                this.autoSubmitTrigger.next(state.searchQuery);
            }
        );

        this.addActionHandler<typeof Actions.SubmitSearchQuery>(
            Actions.SubmitSearchQuery.name,
            (state, action) => {
                if (action.payload.query.length >= state.minQuerySize) {
                    state.isBusy = true;
                }
            },
            (state, action, dispatch) => {
                if (action.payload.query.length >= state.minQuerySize) {
                    this.loadData(state).subscribe(
                        (data) => {
                            dispatch<typeof Actions.DataLoadDone>({
                                name: Actions.DataLoadDone.name,
                                payload: {
                                    data
                                }
                            });
                        },
                        (err) => {
                            this.pageModel.showMessage('error', err);
                            dispatch<typeof Actions.DataLoadDone>({
                                name: Actions.DataLoadDone.name,
                                error: err
                            });
                        }
                    );
                }
            }
        );

        this.addActionHandler<typeof Actions.DataLoadDone>(
            Actions.DataLoadDone.name,
            (state, action) => {
                state.isBusy = false;
                if (action.error) {
                    state.data = [];

                } else {
                    state.data = action.payload.data.data;
                }
            }
        );

        this.addActionHandler<typeof Actions.UseInQuery>(
            Actions.UseInQuery.name,
            null,
            (state, action, dispatch) => {
                const args = new MultiDict();
                args.set('corpname', action.payload.corpname);
                args.set('usesubcorp', action.payload.id);
                window.location.href = this.pageModel.createActionUrl('query', args);
            }

        );
    }

    private loadData(state:PublicSubcorpListState):Observable<LoadDataResponse> {
        // TODO
        const args = new MultiDict();
        args.set('format', 'json');
        args.set('query', state.searchQuery);
        args.set('offset', 0); // TODO
        args.set('limit', 20); // TODO
        return this.pageModel.ajax$<LoadDataResponse>(
            HTTP.Method.GET,
            this.pageModel.createActionUrl('subcorpus/list_published'),
            args
        );
    }

}