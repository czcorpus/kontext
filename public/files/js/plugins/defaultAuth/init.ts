/*
 * Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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

/// <reference path="../../vendor.d.ts/rsvp.d.ts" />

import {Kontext} from '../../types/common';
import {SimplePageStore} from '../../stores/base';
import {PluginInterfaces} from '../../types/plugins';
import {PageModel} from '../../app/main';
import {ActionDispatcher, ActionPayload} from '../../app/dispatcher';
import * as RSVP from 'vendor/rsvp';

import {init as userPaneViewsFactory, UserPaneViews} from './views/pane';
import {init as userProfileViewsFactory, UserProfileViews} from './views/profile';
import {UserProfileStore} from './profile';


/**
 *
 */
export class UserStatusStore extends SimplePageStore {

    pluginApi:Kontext.PluginApi;

    private loginFormVisible:boolean;

    private returnUrl:string;

    constructor(dispatcher:ActionDispatcher, pluginApi:Kontext.PluginApi) {
        super(dispatcher);
        this.pluginApi = pluginApi;
        this.loginFormVisible = false;
        this.returnUrl = null;

        dispatcher.register((payload:ActionPayload) => {
            switch (payload.actionType) {
                case 'USER_SHOW_LOGIN_DIALOG':
                    this.loginFormVisible = true;
                    this.returnUrl = payload.props['returnUrl'];
                    this.notifyChangeListeners();
                break;
                case 'USER_HIDE_LOGIN_DIALOG':
                    this.loginFormVisible = false;
                    this.notifyChangeListeners();
                break;
                case 'USER_LOGOUTX':
                    this.pluginApi.setLocationPost(this.pluginApi.createActionUrl('user/logoutx'), []);
                break;
            }
        });
    }

    getLoginFormVisible():boolean {
        return this.loginFormVisible;
    }

    getReturnUrl():string {
        return this.returnUrl;
    }
}

/**
 *
 */
export class AuthPlugin implements PluginInterfaces.IAuth {

    private store:UserStatusStore;

    private profileStore:UserProfileStore;

    private userPaneViews:UserPaneViews;

    private userProfileViews:UserProfileViews;

    constructor(profileStore:UserProfileStore, store:UserStatusStore, pluginApi:Kontext.PluginApi) {
        this.profileStore = profileStore;
        this.store = store;

        this.userPaneViews = userPaneViewsFactory(
            pluginApi.dispatcher(),
            pluginApi.getComponentHelpers(),
            this.store
        );

        this.userProfileViews = userProfileViewsFactory(
            pluginApi.dispatcher(),
            pluginApi.getComponentHelpers(),
            this.profileStore
        );
    }

    getProfileView():React.ComponentClass {
        return this.userProfileViews.UserProfileView;
    }

    getUserPaneView():React.ComponentClass {
        return this.userPaneViews.UserPane;
    }
}


export default function create(pluginApi:Kontext.PluginApi):RSVP.Promise<PluginInterfaces.IAuth> {
    const plugin = new AuthPlugin(
        new UserProfileStore(
            pluginApi.dispatcher(),
            pluginApi,
            pluginApi.getConf<Kontext.UserCredentials>('User')
        ),
        new UserStatusStore(
            pluginApi.dispatcher(),
            pluginApi
        ),
        pluginApi
    );
    return new RSVP.Promise((resolve:(v)=>void, reject:(err)=>void) => {
        resolve(plugin);
    });
};