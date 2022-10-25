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

import { PageModel } from '../../../app/page';
import { Actions } from '../actions';
import { Actions as MainMenuActions } from '../../mainMenu/actions';
import { mapOpIdToFormType, PersistentQueryOperation, QueryOverviewResponseRow } from './common';
import { AjaxConcResponse } from '../../concordance/common';


interface QueryOverviewResponse extends AjaxConcResponse {
    Desc:Array<QueryOverviewResponseRow>;
}

export interface QueryInfoModelState {
    operations:Array<PersistentQueryOperation>;
    overviewVisible:boolean;
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


        this.addActionHandler<typeof Actions.CloseQueryOverview>(
            Actions.CloseQueryOverview.name,
            (state, action) => {
                state.overviewVisible = false;
            }
        );

        this.addActionHandler<typeof MainMenuActions.OverviewShowQueryInfoDone>(
            MainMenuActions.OverviewShowQueryInfoDone.name,
            (state, action) => {
                state.operations = action.payload.operations;
            }
        );

        this.addActionHandler<typeof MainMenuActions.OverviewShowQueryInfo>(
            MainMenuActions.OverviewShowQueryInfo.name,
            (state, action) => {
                state.overviewVisible = true;
            },
            (state, action, dispatch) => {
                this.loadQueryOverview().subscribe({
                    next: operations => {
                        dispatch<typeof MainMenuActions.OverviewShowQueryInfoDone>({
                            name: MainMenuActions.OverviewShowQueryInfoDone.name,
                            payload: {
                                operations
                            }
                        });
                    },
                    error: error => {
                        this.pageModel.showMessage('error', error);
                    }
                });
            }
        );
    }

    private loadQueryOverview():Observable<Array<PersistentQueryOperation>> {
        return this.pageModel.ajax$<QueryOverviewResponse>(
            HTTP.Method.GET,
            this.pageModel.createActionUrl('concdesc_json'),
            this.pageModel.getConcArgs(),
            {}
        ).pipe(
            map(
                data => List.map(
                    v => ({
                        formType: mapOpIdToFormType(v.opid),
                        concPersistenceId: v.conc_persistence_op_id,
                        op: v.op,
                        opid: v.opid,
                        userEntry: v.nicearg,
                        encodedArgs: v.arg,
                        size: v.size,
                        fullSize: v.fullsize

                    }),
                    data.Desc
                )
            )
        );
    }
}


