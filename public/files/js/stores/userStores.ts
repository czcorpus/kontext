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

/// <reference path="../types/common.d.ts" />
/// <reference path="../vendor.d.ts/flux.d.ts" />
/// <reference path="../vendor.d.ts/rsvp.d.ts" />

import {SimplePageStore} from './base';
import {PageModel} from '../pages/document';
import * as RSVP from 'vendor/rsvp';
import * as Immutable from 'vendor/immutable';

/**
 */
export class UserInfo extends SimplePageStore implements Kontext.IUserInfoStore {

    private layoutModel:PageModel;

    private userData:Kontext.UserCredentials;

    constructor(dispatcher:Kontext.FluxDispatcher, layoutModel:PageModel) {
        super(dispatcher);
        this.layoutModel = layoutModel;
        this.userData = null;

        this.dispatcher.register((payload:Kontext.DispatcherPayload) => {
            switch (payload.actionType) {
                case 'USER_INFO_REQUESTED':
                    this.loadUserInfo().then(
                        (_) => {
                            this.notifyChangeListeners();
                        },
                        (err) => {
                            this.layoutModel.showMessage('error', err);
                            this.notifyChangeListeners();
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