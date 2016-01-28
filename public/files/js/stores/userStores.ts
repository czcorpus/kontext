/*
 * Copyright (c) 2016 Institute of the Czech National Corpus
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

/// <reference path="../../ts/declarations/common.d.ts" />
/// <reference path="../../ts/declarations/flux.d.ts" />
/// <reference path="../../ts/declarations/rsvp.d.ts" />

import util = require('util');
import tplDocument = require('tpl/document');



/**
 */
export class UserInfo extends util.SimplePageStore implements Kontext.UserInfoStore {

    private layoutModel:tplDocument.PageModel;

    private userData:Kontext.UserCredentials;

    constructor(layoutModel:tplDocument.PageModel, dispatcher:Dispatcher.Dispatcher<any>) {
        super(dispatcher);
        let self = this;
        this.layoutModel = layoutModel;
        this.userData = null;

        this.dispatcher.register(function (payload:Kontext.DispatcherPayload) {
            switch (payload.actionType) {
                case 'USER_INFO_REQUESTED':
                    let prom:RSVP.Promise<{user:Kontext.UserCredentials}> = self.loadUserInfo();
                    prom.then(
                        function (data:{user:Kontext.UserCredentials}) {
                            self.userData = data.user;
                            self.notifyChangeListeners('USER_INFO_REFRESHED');
                        },
                        function (err) {
                            console.log('error: ', err); // TODO
                        }
                    )
                    break;
                }
        });
    }


    private loadUserInfo(forceReload:boolean=false):RSVP.Promise<{user:Kontext.UserCredentials}> {
        let self = this;

        if (!this.userData || forceReload) {
            return this.layoutModel.ajax<{user:Kontext.UserCredentials}>(
                'GET',
                this.layoutModel.createActionUrl('user/ajax_user_info'),
                {},
                {
                    contentType : 'application/x-www-form-urlencoded'
                }
            );

        } else {
            return new RSVP.Promise((resolve:(v:{user:Kontext.UserCredentials})=>void,
                    reject:(e:any)=>void) => {
                resolve({user: this.userData});
            });
        }

    }

    getCredentials():Kontext.UserCredentials {
        return this.userData;
    }

}