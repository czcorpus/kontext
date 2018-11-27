/*
 * Copyright (c) 2018 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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
import {ActionDispatcher, Action} from '../../app/dispatcher';
import {IPluginApi} from '../../types/plugins';
import {StatefulModel} from '../../models/base';
import {MultiDict} from '../../util';
import RSVP from 'rsvp';


export class UserProfileModel extends StatefulModel {

    private pluginApi:IPluginApi;

    private currPasswd:string;

    private newPasswd:string;

    private newPasswd2:string;

    private userData:Kontext.UserCredentials;

    constructor(dispatcher:ActionDispatcher, pluginApi:IPluginApi, userData:Kontext.UserCredentials) {
        super(dispatcher);
        this.pluginApi = pluginApi;
        this.userData = userData;
        this.currPasswd = '';
        this.newPasswd = '';
        this.newPasswd2 = '';
        dispatcher.register((action:Action) => {
            switch (action.actionType) {
                case 'USER_PROFILE_SET_CURR_PASSWD':
                    this.currPasswd = action.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'USER_PROFILE_SET_NEW_PASSWD':
                    this.newPasswd = action.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'USER_PROFILE_SET_NEW_PASSWD2':
                    this.newPasswd2 = action.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'USER_PROFILE_SUBMIT_NEW_PASSWORD':
                    this.validateNewPassword().then(
                        (data) => {
                            this.currPasswd = '';
                            this.newPasswd = '';
                            this.newPasswd2 = '';
                            this.pluginApi.showMessage('info',
                                this.pluginApi.translate('user__password_has_been_updated'));
                            this.notifyChangeListeners();
                        },
                        (err) => {
                            this.pluginApi.showMessage('error', err);
                            this.notifyChangeListeners();
                            console.error(err);
                        }
                    );
                break;

            }
        });
    }

    submit():RSVP.Promise<any> { // TODO
        const args = new MultiDict();
        args.set('curr_passwd', this.currPasswd);
        args.set('new_passwd', this.newPasswd);
        args.set('new_passwd2', this.newPasswd2);

        return this.pluginApi.ajax(
            'POST',
            this.pluginApi.createActionUrl('user/set_user_password'),
            args
        );
    }

    private validateNewPassword():RSVP.Promise<{}> {
        return new RSVP.Promise((resolve:(v:boolean)=>void, reject:(err)=>void) => {
            if (this.newPasswd !== this.newPasswd2) {
                reject(this.pluginApi.translate('user__pwd_and_pwd2_do_not_match'))

            } else {
                resolve(true);
            }
        }).then(
            (ans) => {
                return this.pluginApi.ajax(
                    'GET',
                    this.pluginApi.createActionUrl('user/validate_password_props'),
                    {password: this.newPasswd}
                );
            }
        );
    }


    getCurrPasswd():string {
        return this.currPasswd;
    }

    getNewPasswd():string {
        return this.newPasswd;
    }

    getNewPasswd2():string {
        return this.newPasswd2;
    }

    getEmail():string {
        return this.userData.email;
    }

    getFirstname():string {
        return this.userData.firstname;
    }

    getLastname():string {
        return this.userData.lastname;
    }
}