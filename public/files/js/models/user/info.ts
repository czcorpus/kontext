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
import { Observable, of as rxOf } from 'rxjs';

import { Kontext } from '../../types/common';
import { PageModel } from '../../app/page';
import { Actions } from  './actions';
import { HTTP } from 'cnc-tskit';

export interface UserInfoModelState {
    userData:Kontext.UserCredentials|null;
    isBusy:boolean;
}

/**
 */
export class UserInfo extends StatelessModel<UserInfoModelState> {

    private readonly layoutModel:PageModel;

    constructor(dispatcher:IActionDispatcher, layoutModel:PageModel) {
        super(
            dispatcher,
            {
                userData: null,
                isBusy: true
            }
        );
        this.layoutModel = layoutModel;

        this.addActionHandler<typeof Actions.UserInfoLoaded>(
            Actions.UserInfoLoaded.name,
            (state, action) => {
                state.isBusy = false;
                state.userData = action.payload.data;
            }
        );

        this.addActionHandler<typeof Actions.UserInfoRequested>(
            Actions.UserInfoRequested.name,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.loadUserInfo(state).subscribe(
                    (data) => {
                        dispatch<typeof Actions.UserInfoLoaded>({
                            name: Actions.UserInfoLoaded.name,
                            payload: {
                                data: data.user
                            }
                        });
                    },
                    (err) => {
                        this.layoutModel.showMessage('error', err);
                        dispatch<typeof Actions.UserInfoLoaded>({
                            name: Actions.UserInfoLoaded.name,
                            error: err
                        });
                    }
                );
            }
        );
    }

    loadUserInfo(state:UserInfoModelState, forceReload:boolean=false):Observable<{user:Kontext.UserCredentials}> {
        return !state.userData || forceReload ?
            this.layoutModel.ajax$<{user:Kontext.UserCredentials}>(
                HTTP.Method.GET,
                this.layoutModel.createActionUrl('user/ajax_user_info'),
                {}
            ) :
            rxOf({user: state.userData});
    }
}