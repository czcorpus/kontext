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

import { StatefulModel } from 'kombo';
import { PageModel } from '../../app/page';
import { ConcLineModel } from './lines';


export interface RefsColumn {
    name:string;
    val:string;
}

export interface RefsDetailModelState {
    data:Array<RefsColumn>;
    lineIdx:number;
    isBusy:boolean;
}

/**
 * Model providing structural attribute information (aka "text types") related to a specific token
 */
export class RefsDetailModel extends StatefulModel<RefsDetailModelState> {

    private readonly layoutModel:PageModel;

    private readonly linesModel:ConcLineModel;

    constructor(layoutModel:PageModel, dispatcher:IFullActionControl, linesModel:ConcLineModel) {
        super(dispatcher);
        this.layoutModel = layoutModel;
        this.linesModel = linesModel;
        this.lineIdx = null;
        this.data = Array<RefsColumn>();
        this.isBusy = false;

        this.dispatcherRegister((action:Action) => {
            switch (action.name) {
                case 'CONCORDANCE_SHOW_REF_DETAIL':
                    this.isBusy = true;
                    this.emitChange();
                    this.loadRefs(action.payload['corpusId'], action.payload['tokenNumber'], action.payload['lineIdx']).subscribe(
                        () => {
                            this.linesModel.setLineFocus(action.payload['lineIdx'], true);
                            this.linesModel.emitChange();
                            this.isBusy = false;
                            this.emitChange();
                        },
                        (err) => {
                            this.layoutModel.showMessage('error', err);
                            this.isBusy = false;
                            this.emitChange();
                        }
                    );
                break;
                case 'CONCORDANCE_REF_RESET_DETAIL':
                case 'CONCORDANCE_SHOW_SPEECH_DETAIL':
                case 'CONCORDANCE_SHOW_KWIC_DETAIL':
                case 'CONCORDANCE_SHOW_TOKEN_DETAIL':
                    if (this.lineIdx !== null) {
                        this.linesModel.setLineFocus(this.lineIdx, false);
                        this.lineIdx = null;
                        this.emitChange();
                        this.linesModel.emitChange();
                    }
                break;
            }
        });
    }

    getData():Array<[RefsColumn, RefsColumn]> {
        if (this.lineIdx !== null) {
            const ans:Array<[RefsColumn, RefsColumn]> = [];
            for (let i = 0; i < this.data.size; i += 2) {
                ans.push([this.data.get(i), this.data.get(i+1)]);
            }
            return Array<[RefsColumn, RefsColumn]>(ans);

        } else if (this.isBusy) {
            return Array<[RefsColumn, RefsColumn]>();

        } else {
            return null;
        }
    }

    private loadRefs(corpusId:string, tokenNum:number, lineIdx:number):Observable<boolean> {
        return this.layoutModel.ajax$<AjaxResponse.FullRef>(
            'GET',
            this.layoutModel.createActionUrl('fullref'),
            {corpname: corpusId, pos: tokenNum}

        ).pipe(
            tap(
                (data) => {
                    this.lineIdx = lineIdx;
                    this.data = Array<RefsColumn>(data.Refs);
                }
            ),
            map(data => !!data)
        );
    }

    getIsBusy():boolean {
        return this.isBusy;
    }
}