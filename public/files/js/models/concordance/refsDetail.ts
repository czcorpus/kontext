/*
 * Copyright (c) 2016 Charles University, Faculty of Arts,
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

import { IFullActionControl, StatelessModel } from 'kombo';

import { PageModel } from '../../app/page';
import { Actions } from './actions';
import { tuple, HTTP } from 'cnc-tskit';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FullRef, RefsColumn } from './common';


export interface RefsDetailModelState {
    data:Array<[RefsColumn, RefsColumn]>;
    lineIdx:number|null;
    isBusy:boolean;
}

/**
 * Model providing structural attribute information (aka "text types") related to a specific token
 */
export class RefsDetailModel extends StatelessModel<RefsDetailModelState> {

    private readonly layoutModel:PageModel;

    constructor(layoutModel:PageModel, dispatcher:IFullActionControl) {
        super(
            dispatcher,
            {
                lineIdx: null,
                data: [],
                isBusy: true // this is related to an RxJS issue with getState()
                            // where a component mounted "late" starts with initial state...
            }
        );
        this.layoutModel = layoutModel;

        this.addActionHandler<typeof Actions.ShowRefDetail>(
            Actions.ShowRefDetail.name,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.loadRefs(
                    action.payload.corpusId,
                    action.payload.tokenNumber

                ).subscribe({
                    next: data => {
                        dispatch<typeof Actions.ShowRefDetailDone>({
                            name: Actions.ShowRefDetailDone.name,
                            payload: {
                                data,
                                lineIdx: action.payload.lineIdx
                            }
                        });
                    },
                    error: err => {
                        this.layoutModel.showMessage('error', err);
                        dispatch<typeof Actions.ShowRefDetailDone>({
                            name: Actions.ShowRefDetailDone.name,
                            error: err
                        });
                    }
                });
            }
        );

        this.addActionHandler<typeof Actions.ShowRefDetailDone>(
            Actions.ShowRefDetailDone.name,
            (state, action) => {
                state.isBusy = false;
                state.data = action.payload.data;
                state.lineIdx = action.payload.lineIdx;
            }
        );

        this.addActionHandler<typeof Actions.RefResetDetail>(
            Actions.RefResetDetail.name,
            (state, action) => {
                if (state.lineIdx !== null) {
                    state.lineIdx = null;
                    state.data = [];
                }
            }
        ).reduceAlsoOn(
            Actions.ShowSpeechDetail.name,
            Actions.ShowKwicDetail.name,
            Actions.ShowTokenDetail.name
        );
    }

    importData(data:FullRef):Array<[RefsColumn, RefsColumn]> {
        const ans:Array<[RefsColumn, RefsColumn]> = [];
        for (let i = 0; i < data.Refs.length; i += 2) {
            ans.push(tuple(data.Refs[i], data.Refs[i + 1]));
        }
        return ans;
    }

    private loadRefs(
        corpusId:string,
        tokenNum:number,
    ):Observable<Array<[RefsColumn, RefsColumn]>> {
        return this.layoutModel.ajax$<FullRef>(
            HTTP.Method.GET,
            this.layoutModel.createActionUrl('fullref'),
            {corpname: corpusId, pos: tokenNum}

        ).pipe(
            map(
                (data) => this.importData(data)
            )
        );
    }
}