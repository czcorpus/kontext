/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
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

import { IPluginApi, PluginInterfaces } from '../../types/plugins';
import { init as viewInit } from './view';
import { ClarinSiAppBarModel } from './model';
import { IFullActionControl } from 'kombo';

declare var require:any;
require('./style.less');


export class LindatAppBar implements PluginInterfaces.ApplicationBar.IPlugin {

    private readonly model:ClarinSiAppBarModel;

    constructor(
        dispatcher:IFullActionControl,
        pluginApi:IPluginApi,
        model:ClarinSiAppBarModel
    ) {
        this.model = model;
    }

    isActive():boolean {
        return true;
    }

    unregister():void {}

    getRegistrationId():string {
        return this.model.getRegistrationId();
    }
}

const create:PluginInterfaces.ApplicationBar.Factory = (pluginApi, initToolbar) => {
    const model = new ClarinSiAppBarModel(pluginApi.dispatcher(), pluginApi);

    if (initToolbar) {
        const view = viewInit(
            pluginApi.dispatcher(),
            pluginApi.getComponentHelpers(),
            model
        );
        pluginApi.renderReactComponent(
            view,
            document.getElementById('appbar-mount')
        );
    }
    return new LindatAppBar(pluginApi.dispatcher(), pluginApi, model);
};

export default create;
