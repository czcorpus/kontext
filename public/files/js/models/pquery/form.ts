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

import { HTTP, tuple } from 'cnc-tskit';
import { IActionDispatcher, StatelessModel } from 'kombo';
import { Observable } from 'rxjs';
import { PageModel } from '../../app/page';
import { Actions, ActionName } from './actions';


interface HTTPSubmitArgs {

}

interface HTTPSubmitResponse {

}


export interface PqueryFormModelState {
    isBusy:boolean;
    corpname:string;
}


export class PqueryFormModel extends StatelessModel<PqueryFormModelState> {

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
    }

    private submitForm(state:PqueryFormModelState):Observable<HTTPSubmitResponse> {
        return this.layoutModel.ajax$<HTTPSubmitResponse>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl(
                'pquery/submit',
                [tuple('corpname', state.corpname)]
            ),
            {}
        );
    }

}