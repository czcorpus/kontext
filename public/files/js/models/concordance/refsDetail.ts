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
import { Actions, ActionName } from './actions';
import { tuple, HTTP } from 'cnc-tskit';
import { Observable } from 'rxjs';
import { AjaxResponse } from '../../types/ajaxResponses';
import { tap, map } from 'rxjs/operators';
import { RefsColumn } from './common';


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
                isBusy: false
            }
        );
        this.layoutModel = layoutModel;

        this.addActionHandler<Actions.ShowRefDetail>(
            ActionName.ShowRefDetail,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.loadRefs(
                    action.payload.corpusId,
                    action.payload.tokenNumber,
                    action.payload.lineIdx

                ).subscribe(
                    (data) => {
                        dispatch<Actions.ShowRefDetailDone>({
                            name: ActionName.ShowRefDetailDone,
                            payload: {
                                data: data,
                                lineIdx: action.payload.lineIdx
                            }
                        });
                    },
                    (err) => {
                        this.layoutModel.showMessage('error', err);
                        dispatch<Actions.ShowRefDetailDone>({
                            name: ActionName.ShowRefDetailDone,
                            error: err
                        });
                    }
                );
            }
        );

        this.addActionHandler<Actions.ShowRefDetailDone>(
            ActionName.ShowRefDetailDone,
            (state, action) => {
                state.isBusy = false;
                state.data = action.payload.data;
                state.lineIdx = action.payload.lineIdx;
            }
        );

        this.addActionHandler<Actions.RefResetDetail>(
            ActionName.RefResetDetail,
            (state, action) => {
                if (state.lineIdx !== null) {
                    state.lineIdx = null;
                    state.data = [];
                }
            }
        ).reduceAlsoOn(
            ActionName.ShowSpeechDetail,
            ActionName.ShowKwicDetail,
            ActionName.ShowTokenDetail
        );
    }

    importData(data:AjaxResponse.FullRef):Array<[RefsColumn, RefsColumn]> {
        const ans:Array<[RefsColumn, RefsColumn]> = [];
        for (let i = 0; i < data.Refs.length; i += 2) {
            ans.push(tuple(data.Refs[i], data.Refs[i + 1]));
        }
        return ans;
    }

    private loadRefs(corpusId:string, tokenNum:number, lineIdx:number):Observable<Array<[RefsColumn, RefsColumn]>> {
        return this.layoutModel.ajax$<AjaxResponse.FullRef>(
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