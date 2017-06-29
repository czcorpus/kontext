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

/// <reference path="../../types/common.d.ts" />
/// <reference path="../../../ts/declarations/rsvp.d.ts" />

import {SimplePageStore} from '../../stores/base';
import {PageModel} from '../../tpl/document';
import * as RSVP from 'vendor/rsvp';

/**
 *
 */
export class UserStatusStore extends SimplePageStore {

    pluginApi:Kontext.PluginApi;

    constructor(dispatcher:Kontext.FluxDispatcher, pluginApi:Kontext.PluginApi) {
        super(dispatcher);
        this.pluginApi = pluginApi;

        dispatcher.register((payload:Kontext.DispatcherPayload) => {
            switch (payload.actionType) {
                case 'USER_SHOW_LOGIN_DIALOG':
                    window.location.href = this.pluginApi.createActionUrl('user/login');
                break;
            }
        });
    }
}

export class AuthPlugin implements PluginInterfaces.IAuth {

    private store:UserStatusStore;

    constructor(store:UserStatusStore) {
        this.store = store;
    }
}


export default function create(pluginApi:Kontext.PluginApi):RSVP.Promise<PluginInterfaces.IAuth> {
    const plugin = new AuthPlugin(new UserStatusStore(pluginApi.dispatcher(), pluginApi));
    return new RSVP.Promise((resolve:(v)=>void, reject:(err)=>void) => {
        resolve(plugin);
    });
};