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

import {Kontext} from '../../types/common';
import {StatefulModel} from '../base';
import {PageModel} from '../../app/page';
import RSVP from 'rsvp';
import { Action, IFullActionControl } from 'kombo';

/**
 */
export class UserInfo extends StatefulModel implements Kontext.IUserInfoModel {

    private layoutModel:PageModel;

    private userData:Kontext.UserCredentials;

    constructor(dispatcher:IFullActionControl, layoutModel:PageModel) {
        super(dispatcher);
        this.layoutModel = layoutModel;
        this.userData = null;

        this.dispatcher.registerActionListener((action:Action) => {
            switch (action.name) {
                case 'USER_INFO_REQUESTED':
                    this.loadUserInfo().then(
                        (_) => {
                            this.emitChange();
                        },
                        (err) => {
                            this.layoutModel.showMessage('error', err);
                            this.emitChange();
                        }
                    );
                break;
            }
        });
    }


    loadUserInfo(forceReload:boolean=false):RSVP.Promise<boolean> {
        return (() => {
            if (!this.userData || forceReload) {
                return this.layoutModel.ajax<{user:Kontext.UserCredentials}>(
                    'GET',
                    this.layoutModel.createActionUrl('user/ajax_user_info'),
                    {}
                );

            } else {
                return new RSVP.Promise((resolve:(v:{user:Kontext.UserCredentials})=>void,
                        reject:(e:any)=>void) => {
                    resolve({user: this.userData});
                });
            }
        })().then(
            (data) => {
                this.userData = data.user;
                return true;
            }
        );
    }

    getCredentials():Kontext.UserCredentials {
        return this.userData;
    }

}