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

/// <reference path="./external.d.ts" />

import {PluginInterfaces} from '../../types/plugins';
import * as toolbar from 'plugins/applicationBar/toolbar';
import {PageModel} from '../../app/page';
import {StatefulModel} from '../../models/base';
import { Action, IFullActionControl } from 'kombo';

export class AppBarModel extends StatefulModel {

    private layoutModel:PageModel;

    constructor(dispatcher:IFullActionControl) {
        super(dispatcher);

        this.dispatcher.registerActionListener((action:Action) => {
            switch (action.name) {
                case 'USER_SHOW_LOGIN_DIALOG':
                    try {
                        toolbar.openLoginDialog();

                    } catch (e) {
                        console.error(e);
                        this.layoutModel.showMessage('error', this.layoutModel.translate('ucnkAppBar3__failed_to_initialize_toolbar'));
                    }
                break;
            }
        });
    }
}

export class AppBarPlugin implements PluginInterfaces.ApplicationBar.IPlugin {

    private model:AppBarModel;

    constructor(model:AppBarModel) {
        this.model = model;
    }
}

const create:PluginInterfaces.ApplicationBar.Factory = (pluginApi) => {
    toolbar.init();
    return new AppBarPlugin(new AppBarModel(pluginApi.dispatcher()));
};

export default create;
