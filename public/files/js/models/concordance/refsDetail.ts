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

import { StatefulModel, IFullActionControl } from 'kombo';

import { PageModel } from '../../app/page';
import { ConcordanceModel } from './main';
import { Actions, ActionName } from './actions';
import { tuple, HTTP } from 'cnc-tskit';
import { Observable } from 'rxjs';
import { AjaxResponse } from '../../types/ajaxResponses';
import { tap, map } from 'rxjs/operators';


export interface RefsColumn {
    name:string;
    val:string;
}

export interface RefsDetailModelState {
    data:Array<[RefsColumn, RefsColumn]>;
    lineIdx:number|null;
    isBusy:boolean;
}

/**
 * Model providing structural attribute information (aka "text types") related to a specific token
 */
export class RefsDetailModel extends StatefulModel<RefsDetailModelState> {

    private readonly layoutModel:PageModel;

    private readonly concModel:ConcordanceModel;

    constructor(layoutModel:PageModel, dispatcher:IFullActionControl, linesModel:ConcordanceModel) {
        super(
            dispatcher,
            {
                lineIdx: null,
                data: [],
                isBusy: false
            }
        );
        this.layoutModel = layoutModel;
        this.concModel = linesModel;

        this.addActionHandler<Actions.ShowRefDetail>(
            ActionName.ShowRefDetail,
            action => {
                this.changeState(state => {state.isBusy = true});
                this.emitChange();
                this.loadRefs(
                    action.payload.corpusId,
                    action.payload.tokenNumber,
                    action.payload.lineIdx

                ).subscribe(
                    () => {
                        this.concModel.setLineFocus(action.payload['lineIdx'], true);
                        this.concModel.emitChange();
                        this.changeState(state => {state.isBusy = false});
                        this.emitChange();
                    },
                    (err) => {
                        this.layoutModel.showMessage('error', err);
                        this.changeState(state => {state.isBusy = false});
                        this.emitChange();
                    }
                );
            }
        );

        this.addActionHandler<Actions.RefResetDetail>(
            [
                ActionName.RefResetDetail,
                ActionName.ShowSpeechDetail,
                ActionName.ShowKwicDetail,
                ActionName.ShowTokenDetail
            ],
            action => {
                if (this.state.lineIdx !== null) {
                    this.concModel.setLineFocus(this.state.lineIdx, false);
                    this.changeState(state => {state.lineIdx = null});
                    this.emitChange();
                    this.concModel.emitChange();
                }
            }
        );
    }

    unregister():void {}

    importData(data:AjaxResponse.FullRef):Array<[RefsColumn, RefsColumn]> {
        const ans:Array<[RefsColumn, RefsColumn]> = [];
        for (let i = 0; i < data.Refs.length; i += 2) {
            ans.push(tuple(data.Refs[i], data.Refs[i + 1]));
        }
        return ans;
    }

    private loadRefs(corpusId:string, tokenNum:number, lineIdx:number):Observable<boolean> {
        return this.layoutModel.ajax$<AjaxResponse.FullRef>(
            HTTP.Method.GET,
            this.layoutModel.createActionUrl('fullref'),
            {corpname: corpusId, pos: tokenNum}

        ).pipe(
            tap(
                (data) => {
                    this.changeState(state => {
                        state.lineIdx = lineIdx;
                        state.data = this.importData(data);
                    });
                }
            ),
            map(data => !!data)
        );
    }
}