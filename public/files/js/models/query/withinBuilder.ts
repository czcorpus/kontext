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

import { IFullActionControl, StatelessModel } from 'kombo';
import { Observable } from 'rxjs';

import { PageModel } from '../../app/page';
import { Actions, ActionName } from './actions';
import { HTTP, List, Dict, pipe, tuple } from 'cnc-tskit';
import { WithinBuilderData } from './common';
import { IUnregistrable } from '../common/common';
import { Actions as GlobalActions, ActionName as GlobalActionName } from '../common/actions';


export interface WithinBuilderModelState {
    data:Array<[string, string]>;
    query:string;
    currAttrIdx:number;
    isBusy:boolean;
}

/**
 *
 */
export class WithinBuilderModel extends StatelessModel<WithinBuilderModelState>
        implements IUnregistrable {

    private readonly pageModel:PageModel;

    constructor(dispatcher:IFullActionControl, pageModel:PageModel) {
        super(
            dispatcher,
            {
                data: [],
                query: '',
                currAttrIdx: 0,
                isBusy: false
            }
        );
        this.pageModel = pageModel;

        this.addActionHandler<Actions.LoadWithinBuilderDataDone>(
            ActionName.LoadWithinBuilderDataDone,
            (state, action) => {
                state.data = pipe(
                    action.payload.data.structattrs,
                    Dict.toEntries(),
                    List.flatMap(([k, v]) => List.map(v2 => tuple(k, v2), v))
                );
                state.isBusy = false;
            }
        );

        this.addActionHandler<Actions.LoadWithinBuilderData>(
            ActionName.LoadWithinBuilderData,
            (state, action) => {
                state.isBusy = true;
                state.data = [];
                state.currAttrIdx = 0;
            },
            (state, action, dispatch) => {
                this.loadAttrs().subscribe(
                    (data) => {
                        dispatch<Actions.LoadWithinBuilderDataDone>({
                            name: ActionName.LoadWithinBuilderDataDone,
                            payload: {
                                data: data
                            }
                        });
                    },
                    (err) => {
                        this.pageModel.showMessage('error', err);
                        dispatch<Actions.LoadWithinBuilderDataDone>({
                            name: ActionName.LoadWithinBuilderDataDone,
                            error: err
                        });
                    }
                );
            }
        );

        this.addActionHandler<Actions.SetWithinValue>(
            ActionName.SetWithinValue,
            (state, action) => {
                state.query = action.payload.value;
            }
        );

        this.addActionHandler<Actions.SetWithinAttr>(
            ActionName.SetWithinAttr,
            (state, action) => {
                if (action.payload.idx < state.data.length) {
                    state.currAttrIdx = action.payload.idx;
                }
            }
        );

        this.addActionHandler<GlobalActions.SwitchCorpus>(
            GlobalActionName.SwitchCorpus,
            null,
            (state, action, dispatch) => {
                dispatch<GlobalActions.SwitchCorpusReady<{}>>({
                    name: GlobalActionName.SwitchCorpusReady,
                    payload: {
                        modelId: this.getRegistrationId(),
                        data: {}
                    }
                });
            }
        );
    }

    getRegistrationId():string {
        return 'within-builder-model';
    }

    private loadAttrs():Observable<WithinBuilderData> {
        return this.pageModel.ajax$<WithinBuilderData>(
            HTTP.Method.GET,
            this.pageModel.createActionUrl('corpora/ajax_get_structattrs_details'),
            {
                corpname: this.pageModel.getCorpusIdent().id
            }

        );
    }

    static exportQuery(state:WithinBuilderModelState):string {
        return state.data.length > 0 ?
            `within <${state.data[state.currAttrIdx].join(' ')}="${state.query}" />`
            : '';
    }

    static ithValue(state:WithinBuilderModelState, i:number):string {
        return state.data[i] ? state.data[i].join('.') : '?.?';
    }
}
