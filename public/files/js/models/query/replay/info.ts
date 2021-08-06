/*
 * Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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

import { StatelessModel, IActionDispatcher } from 'kombo';
import { List, HTTP } from 'cnc-tskit';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { Kontext } from '../../../types/common';
import { PageModel } from '../../../app/page';
import { Actions } from '../actions';
import { ActionName as MMActionName, Actions as MMActions } from '../../mainMenu/actions';
import { QueryOverviewResponseRow } from './common';
import { AjaxConcResponse } from '../../concordance/common';


interface QueryOverviewResponse extends AjaxConcResponse {
    Desc:Array<QueryOverviewResponseRow>;
}

export interface QueryInfoModelState {
    currentQueryOverview:Array<Kontext.QueryOperation>|null;
}

/**
 * This is a basic variant of query info/replay store which
 * can only fetch query overview info without any edit
 * functions. It is typically used on pages where an active
 * concordance exists but it is not visible at the moment
 * (e.g. freq. & coll. pages). In such case it is typically
 * extended further (see IndirectQueryReplayModel) to allow
 * returning to the 'view' page in case user wants to use
 * some of its functions.
 */
export class QueryInfoModel<T extends QueryInfoModelState> extends StatelessModel<T> {

    protected readonly pageModel:PageModel;

    constructor(dispatcher:IActionDispatcher, pageModel:PageModel, initState:T) {
        super(dispatcher, initState);
        this.pageModel = pageModel;


        this.addActionHandler<typeof Actions.ClearQueryOverviewData>(
            Actions.ClearQueryOverviewData.name,
            (state, action) => {
                state.currentQueryOverview = null;
            }
        );

        this.addActionHandler<MMActions.OverviewShowQueryInfoDone>(
            MMActionName.OverviewShowQueryInfoDone,
            (state, action) => {
                state.currentQueryOverview = action.payload.Desc
            }
        )

        this.addActionHandler<MMActions.OverviewShowQueryInfo>(
            MMActionName.OverviewShowQueryInfo,
            (state, action) => {

            },
            (state, action, dispatch) => {
                this.loadQueryOverview().subscribe(
                    (data) => {
                        dispatch<MMActions.OverviewShowQueryInfoDone>({
                            name: MMActionName.OverviewShowQueryInfoDone,
                            payload: {
                                Desc: data
                            }
                        });
                    },
                    (err) => {
                        this.pageModel.showMessage('error', err);
                    }
                )
            }
        );
    }

    private loadQueryOverview():Observable<Array<Kontext.QueryOperation>> {
        return this.pageModel.ajax$<QueryOverviewResponse>(
            HTTP.Method.GET,
            this.pageModel.createActionUrl('concdesc_json'),
            this.pageModel.exportConcArgs(),
            {}
        ).pipe(
            map(
                data => List.map(
                    v => ({arg: '', ...v}),
                    data.Desc
                )
            )
        )
    }
}


