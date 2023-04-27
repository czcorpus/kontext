/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
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

import { IActionDispatcher, StatelessModel } from 'kombo';
import { PageModel } from '../../app/page';
import { Actions } from './actions';
import { Actions as ConcActions } from '../concordance/actions';


export interface ConcRestoreModelState {
    isBusy:boolean;
    concPersistenceId:string;
    nextAction:string;
    nextActionArgs:{[k:string]:string|number|Array<string>|Array<number>};
    nextActionLink:string|undefined;
}


export class ConcRestoreModel extends StatelessModel<ConcRestoreModelState> {

    private readonly layoutModel:PageModel;

    constructor(dispatcher:IActionDispatcher, state:ConcRestoreModelState, layoutModel:PageModel) {
        super(dispatcher, state);
        this.layoutModel = layoutModel;

        this.addActionHandler<typeof ConcActions.AsyncCalculationUpdated>(
            ConcActions.AsyncCalculationUpdated.name,
            (state, action) => {
                if (action.error) {
                    state.isBusy = false;

                } else if (action.payload.finished) {
                    this.generateNextLink(state);
                    state.isBusy = false;
                }
            },
            (state, action, dispatch) => {
                if (action.error) {
                    this.layoutModel.showMessage('error', this.layoutModel.translate('concRestore__failed_to_restore'));
                    console.error(action.error);

                } else if (!state.isBusy && state.nextActionLink) {
                    window.location.href = state.nextActionLink;
                }
            }
        );

        this.addActionHandler<typeof ConcActions.AsyncCalculationFailed>(
            ConcActions.AsyncCalculationFailed.name,
            (state, action) => {
                state.isBusy = false;
            },
            (state, action, dispatch) => {
                this.layoutModel.showMessage('error', this.layoutModel.translate('concRestore__failed_to_restore'));
            }
        );

        this.addActionHandler<typeof Actions.ConcRestored>(
            Actions.ConcRestored.name,
            (state, action) => {
                state.isBusy = false;
                this.generateNextLink(state);
            },
            (state, action, dispatch) => {
                window.location.href = state.nextActionLink;
            }
        );
    }

    private generateNextLink(state:ConcRestoreModelState):void {
        state.nextActionLink = this.layoutModel.createActionUrl(
            state.nextAction,
            {
                ...this.layoutModel.getConcArgs(),
                ...state.nextActionArgs
            }
        );
    }

}