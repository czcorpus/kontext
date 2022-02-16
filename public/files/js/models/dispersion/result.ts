/*
 * Copyright (c) 2022 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2022 Martin Zimandl <martin.zimandl@gmail.com>
 * Copyright (c) 2022 Tomas Machalek <tomas.machalek@gmail.com>

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

import { IActionQueue, StatelessModel } from 'kombo';
import { PageModel } from '../../app/page';
import { Actions } from './actions';


export interface DispersionResultModelState {
    isBusy:boolean;
    concordanceId:string;
}


export class DispersionResultModel extends StatelessModel<DispersionResultModelState> {

    private readonly layoutModel:PageModel;


    constructor(dispatcher:IActionQueue, layoutModel:PageModel, initialState:DispersionResultModelState) {
        super(dispatcher, initialState);
        this.layoutModel = layoutModel;

        this.addActionHandler(
            Actions.SubmitForm,
            (state, action) => {

            },
            (state, action, dispatch) => {
                if (action.payload.reloadPage) {
                    window.location.href = this.layoutModel.createActionUrl(
                        'dispersion/index',
                        {q: `~${state.concordanceId}`}
                    );
                }
            }
        )
    }
}