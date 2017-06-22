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

/// <reference path="../../types/common.d.ts" />
/// <reference path="../../types/plugins/abstract.d.ts" />
/// <reference path="../../../ts/declarations/rsvp.d.ts" />

import * as RSVP from 'vendor/rsvp';
import * as toolbar from 'plugins/applicationBar/toolbar';
import {PageModel} from '../../tpl/document';
import {SimplePageStore} from '../../stores/base';


export class AppBarStore extends SimplePageStore {

    private layoutModel:PageModel;

    constructor(dispatcher:Kontext.FluxDispatcher) {
        super(dispatcher);
        const self = this;

        this.dispatcher.register(function (payload:Kontext.DispatcherPayload) {
            switch (payload.actionType) {
                case 'USER_SHOW_LOGIN_DIALOG':
                    try {
                        toolbar.openLoginDialog();

                    } catch (e) {
                        console.error(e);
                        self.layoutModel.showMessage('error', self.layoutModel.translate('ucnkAppBar3__failed_to_initialize_toolbar'));
                    }
                    break;
            }
        });
    }
}

export class AppBarPlugin implements Kontext.Plugin {

    private store:AppBarStore;

    constructor(store:AppBarStore) {
        this.store = store;
    }

    init(api:Kontext.PluginApi):void {}
}

export function create(pluginApi:Kontext.PluginApi):RSVP.Promise<Kontext.Plugin> {
    return new RSVP.Promise((resolve:(ans:Kontext.Plugin)=>void, reject:(e:any)=>void) => {
        toolbar.init();
        const appBarStore = new AppBarStore(pluginApi.dispatcher());
        resolve(new AppBarPlugin(appBarStore));
    });
}



