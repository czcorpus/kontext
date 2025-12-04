/*
 * Copyright (c) 2018 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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

import { PageModel } from '../../app/page.js';
import * as Kontext from '../../types/kontext.js';
import { StatelessModel, IActionDispatcher } from 'kombo';
import { Observable, Subject } from 'rxjs';
import { Actions } from './actions.js';
import { HTTP } from 'cnc-tskit';
import { debounceTime } from 'rxjs/operators';
import { importServerSubcList, SubcorpusServerRecord } from './common.js';
import { SubcorpListItem } from './list.js';


export interface LoadDataResponse extends Kontext.AjaxResponse {
    data:Array<SubcorpusServerRecord>;
}

export interface PublicSubcorpListState {
    isBusy:boolean;
    data:Array<SubcorpListItem>;
    searchQuery:string;
    minQuerySize:number;
    onlyCurrCorpus:boolean;
    corpname:string;
}

export class PublicSubcorpListModel extends StatelessModel<PublicSubcorpListState> {

    queryTypeMinPrefixMapping:{[key:string]:number};

    private pageModel:PageModel;

    private autoSubmitTrigger:Subject<string>;

    constructor(
        dispatcher:IActionDispatcher,
        pageModel:PageModel,
        data:Array<SubcorpListItem>,
        minQuerySize:number,
        onlyCurrCorpus:boolean,
        corpname:string
    ) {
        super(
            dispatcher,
            {
                isBusy: false,
                data,
                searchQuery: '',
                minQuerySize,
                corpname,
                onlyCurrCorpus
            }
        );
        this.autoSubmitTrigger = new Subject<string>();
        this.autoSubmitTrigger.pipe(
            debounceTime(Kontext.TEXT_INPUT_WRITE_THROTTLE_INTERVAL_MS)

        ).subscribe({
            next: query => {
                dispatcher.dispatch<typeof Actions.SubmitSearchQuery>({
                    name: Actions.SubmitSearchQuery.name,
                    payload: {
                        query
                    }
                });
            },
            error: error => {
                this.pageModel.showMessage('error', error);
                dispatcher.dispatch<typeof Actions.SubmitSearchQuery>({
                    name: Actions.SubmitSearchQuery.name,
                    error
                });
            }
        });

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
                    this.loadData(state).subscribe({
                        next: data => {
                            dispatch<typeof Actions.DataLoadDone>({
                                name: Actions.DataLoadDone.name,
                                payload: {
                                    widgetId: action.payload.widgetId,
                                    data
                                }
                            });
                        },
                        error: error => {
                            this.pageModel.showMessage('error', error);
                            dispatch<typeof Actions.DataLoadDone>({
                                name: Actions.DataLoadDone.name,
                                error
                            });
                        }
                    });
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
                    state.data = importServerSubcList(action.payload.data.data);
                }
            }
        );

        this.addActionHandler(
            Actions.UseInQuery,
            null,
            (state, action, dispatch) => {
                window.location.href = this.pageModel.createActionUrl(
                    'query',
                    {
                        corpname: action.payload.corpname,
                        usesubcorp: action.payload.id
                    }
                );
            }
        );

        this.addActionHandler(
            Actions.PubSubcToggleOnlyCurrCorpus,
            (state, action) => {
                state.onlyCurrCorpus = !state.onlyCurrCorpus;
            },
            (state, action, dispatch) => {
                this.autoSubmitTrigger.next(state.searchQuery);
            }
        )
    }

    private loadData(state:PublicSubcorpListState):Observable<LoadDataResponse> {
        // TODO
        return this.pageModel.ajax$<LoadDataResponse>(
            HTTP.Method.GET,
            this.pageModel.createActionUrl('subcorpus/list_published'),
            {
                format: 'json',
                ia_query: state.searchQuery,
                corpname: state.onlyCurrCorpus ? state.corpname : undefined,
                offset: 0, // TODO
                limit: 20, // TODO
            }
        );
    }

}