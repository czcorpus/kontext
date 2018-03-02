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

/// <reference path="../../types/plugins.d.ts" />
/// <reference path="../../vendor.d.ts/rsvp.d.ts" />

import {Kontext} from '../../types/common';
import {PluginInterfaces, IPluginApi} from '../../types/plugins';
import * as RSVP from 'vendor/rsvp';
import * as toolbar from 'plugins/applicationBar/toolbar';
import {PageModel} from '../../app/main';
import {StatefulModel} from '../../stores/base';
import {ActionDispatcher, ActionPayload} from '../../app/dispatcher';

export class AppBarStore extends StatefulModel {

    private layoutModel:PageModel;

    constructor(dispatcher:ActionDispatcher) {
        super(dispatcher);
        const self = this;

        this.dispatcher.register(function (payload:ActionPayload) {
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

export class AppBarPlugin implements PluginInterfaces.IToolbar {

    private store:AppBarStore;

    constructor(store:AppBarStore) {
        this.store = store;
    }
}

export default function create(pluginApi:IPluginApi):RSVP.Promise<PluginInterfaces.IToolbar> {
    return new RSVP.Promise((resolve:(ans:PluginInterfaces.IToolbar)=>void, reject:(e:any)=>void) => {
        toolbar.init();
        const appBarStore = new AppBarStore(pluginApi.dispatcher());
        resolve(new AppBarPlugin(appBarStore));
    });
}



