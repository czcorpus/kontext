/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
 * Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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

import { Dict, HTTP, List, tuple } from 'cnc-tskit';
import { IActionDispatcher, StatelessModel } from 'kombo';
import { Observable } from 'rxjs';
import { PageModel } from '../../app/page';
import { Actions, ActionName } from './actions';
import { IUnregistrable } from '../common/common';
import { Actions as GlobalActions, ActionName as GlobalActionName } from '../common/actions';
import { Actions as QueryActions, ActionName as QueryActionName } from '../query/actions';
import { NonQueryCorpusSelectionModel } from '../corpsel';
import { AdvancedQuery } from '../query/query';


interface HTTPSubmitArgs {

}

interface HTTPSubmitResponse {

}


export interface PqueryFormModelState {
    isBusy:boolean;
    corpname:string;
    usesubcorp:string;
    queries:{[sourceId:string]:AdvancedQuery}; // pquery block -> query
}

interface PqueryFormModelSwitchPreserve {

}

export function generatePqueryName(i:number):string {
    return `pqitem_${i}`;
}


export class PqueryFormModel extends StatelessModel<PqueryFormModelState> implements IUnregistrable {

    private readonly layoutModel:PageModel;

    constructor(dispatcher:IActionDispatcher, initState:PqueryFormModelState, layoutModel:PageModel) {
        super(dispatcher, initState);
        this.layoutModel = layoutModel;

        this.addActionHandler<Actions.SubmitQuery>(
            ActionName.SubmitQuery,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.submitForm(state).subscribe(
                    (resp) => {
                        dispatch<Actions.SubmitQueryDone>({
                            name: ActionName.SubmitQueryDone,
                            payload: {},
                        });
                    },
                    (error) => {
                        this.layoutModel.showMessage('error', error);
                        dispatch<Actions.SubmitQueryDone>({
                            name: ActionName.SubmitQueryDone,
                            payload: {},
                            error
                        });
                    }
                )
            }
        );

        this.addActionHandler<Actions.SubmitQueryDone>(
            ActionName.SubmitQueryDone,
            (state, action) => {
                state.isBusy = false;
            }
        );

        this.addActionHandler<GlobalActions.CorpusSwitchModelRestore>(
            GlobalActionName.CorpusSwitchModelRestore,
            (state, action) => {
                if (!action.error) {
                    this.deserialize(
                        state,
                        action.payload.data[this.getRegistrationId()] as
                            PqueryFormModelSwitchPreserve,
                        action.payload.corpora
                    );
                }
            }
        );

        this.addActionHandler<GlobalActions.SwitchCorpus>(
            GlobalActionName.SwitchCorpus,
            (state, action) => {
                dispatcher.dispatch<GlobalActions.SwitchCorpusReady<
                        PqueryFormModelSwitchPreserve>>({
                    name: GlobalActionName.SwitchCorpusReady,
                    payload: {
                        modelId: this.getRegistrationId(),
                        data: this.serialize(
                            state,
                            action.payload.corpora,
                            action.payload.newPrimaryCorpus
                        )
                    }
                });
            }
        );

        this.addActionHandler<QueryActions.QueryInputSelectSubcorp>(
            QueryActionName.QueryInputSelectSubcorp,
            (state, action) => {
                state.usesubcorp = action.payload.subcorp;
            }
        );

        this.addActionHandler<Actions.AddQueryItem>(
            ActionName.AddQueryItem,
            (state, action) => {
                const size = Dict.size(state.queries);
                state.queries[generatePqueryName(size)] = {
                    corpname: state.corpname,
                    qtype: 'advanced',
                    query: '',
                    queryHtml: '',
                    rawAnchorIdx: 0,
                    rawFocusIdx: 0,
                    parsedAttrs: [],
                    focusedAttr: undefined,
                    pcq_pos_neg: 'pos',
                    include_empty: false,
                    default_attr: null
                }
            }
        );

        this.addActionHandler<Actions.RemoveQueryItem>(
            ActionName.RemoveQueryItem,
            (state, action) => {
                state.queries = Dict.fromEntries(
                    List.reduce((acc, [k, v]) => {
                            if (k !== action.payload.sourceId) {
                                acc.push([generatePqueryName(List.size(acc)), v])
                            }
                            return acc;
                        },
                        [],
                        Dict.toEntries(state.queries)
                    )
                );
            }
        );

        this.addActionHandler<Actions.QueryChange>(
            ActionName.QueryChange,
            (state, action) => {
                state.queries[action.payload.sourceId].query = action.payload.query;
                state.queries[action.payload.sourceId].queryHtml = action.payload.query;                
            }
        );
    }


    private deserialize(
        state:PqueryFormModelState,
        data:PqueryFormModelSwitchPreserve,
        corpora:Array<[string, string]>
    ):void {

        if (data) {
            console.log('should deserialize ', corpora)
        }
    }

    private serialize(
        state:PqueryFormModelState,
        newCorpora:Array<string>,
        newPrimaryCorpus:string|undefined
    ):PqueryFormModelSwitchPreserve {
        return {};
    }

    private submitForm(state:PqueryFormModelState):Observable<HTTPSubmitResponse> {
        return this.layoutModel.ajax$<HTTPSubmitResponse>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl(
                'pquery/submit',
                [tuple('corpname', state.corpname), tuple('usesubcorp', state.usesubcorp)]
            ),
            {}
        );
    }

    getRegistrationId():string {
        return 'paradigmatic-query-form-model';
    }

}