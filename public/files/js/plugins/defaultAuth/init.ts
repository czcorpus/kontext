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

import {Kontext} from '../../types/common';
import {StatefulModel} from '../../models/base';
import {PluginInterfaces, IPluginApi} from '../../types/plugins';
import {ActionDispatcher, Action} from '../../app/dispatcher';

import {init as userPaneViewsFactory, UserPaneViews} from './views/pane';
import {init as userProfileViewsFactory, UserProfileViews} from './views/profile';
import {init as userSignUpViewsFactory, UserSignUpViews} from './views/signUp';
import {UserProfileModel} from './profile';


/**
 *
 */
export class UserStatusModel extends StatefulModel {

    pluginApi:IPluginApi;

    private loginFormVisible:boolean;

    private returnUrl:string;

    constructor(dispatcher:ActionDispatcher, pluginApi:IPluginApi) {
        super(dispatcher);
        this.pluginApi = pluginApi;
        this.loginFormVisible = false;
        this.returnUrl = null;

        dispatcher.register((action:Action) => {
            switch (action.actionType) {
                case 'USER_SHOW_LOGIN_DIALOG':
                    this.loginFormVisible = true;
                    this.returnUrl = action.props['returnUrl'];
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
export class AuthPlugin implements PluginInterfaces.Auth.IPlugin {

    private model:UserStatusModel;

    private profileModel:UserProfileModel;

    private userPaneViews:UserPaneViews;

    private userProfileViews:UserProfileViews;

    private userSignUpViews:UserSignUpViews;

    constructor(profileModel:UserProfileModel, model:UserStatusModel, pluginApi:IPluginApi) {
        this.profileModel = profileModel;
        this.model = model;

        this.userPaneViews = userPaneViewsFactory(
            pluginApi.dispatcher(),
            pluginApi.getComponentHelpers(),
            this.model
        );

        this.userProfileViews = userProfileViewsFactory(
            pluginApi.dispatcher(),
            pluginApi.getComponentHelpers(),
            this.profileModel
        );

        this.userSignUpViews = userSignUpViewsFactory(
            pluginApi.dispatcher(),
            pluginApi.getComponentHelpers(),
            this.profileModel,
            this.userProfileViews
        );
    }

    getProfileView():React.ComponentClass {
        return this.userProfileViews.UserProfileView;
    }

    getUserPaneView():React.ComponentClass {
        return this.userPaneViews.UserPane;
    }

    getSignUpView():React.ComponentClass {
        return this.userSignUpViews.SignUpForm;
    }
}


const create:PluginInterfaces.Auth.Factory = (pluginApi) => {
    const userCredentials = pluginApi.getConf<Kontext.UserCredentials>('CredentialsForm') ||
        {username: '', firstname: '', lastname: '', email: '', active: false};
    const plugin = new AuthPlugin(
        new UserProfileModel(
            pluginApi.dispatcher(),
            pluginApi,
            {
                id: -1,
                username: userCredentials.username || '',
                firstname: userCredentials.firstname || '',
                lastname: userCredentials.lastname || '',
                email: userCredentials.email || '',
                active: userCredentials.active || false
            },
            pluginApi.getConf<string>('UsernameTaken') ?
                pluginApi.translate('user__sorry_username_taken') :
                ''
        ),
        new UserStatusModel(
            pluginApi.dispatcher(),
            pluginApi
        ),
        pluginApi
    );
    return plugin;
};

export default create;