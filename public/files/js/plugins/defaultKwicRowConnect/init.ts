/*
 * Copyright (c) 2023 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2023 Martin Zimandl <martin.zimandl@gmail.com>
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

import * as PluginInterfaces from '../../types/plugins';
import { KwicRowConnectModel } from './model';
import { IPluginApi } from '../../types/plugins/common';


interface PluginData {
    kwic_row_connect: {
    }
}


export class DefaultKwicRowConnectPlugin implements PluginInterfaces.KwicRowConnect.IPlugin {

    private pluginApi:IPluginApi;

    private model:KwicRowConnectModel;

    constructor(
        pluginApi:IPluginApi,
    ) {
        this.pluginApi = pluginApi;
        this.model = new KwicRowConnectModel({
            dispatcher: pluginApi.dispatcher(),
            pluginApi,
        });
    }

    isActive():boolean {
        return true;
    }

    init():void {
    }
}


export const create:PluginInterfaces.KwicRowConnect.Factory = (
            pluginApi:IPluginApi,
    ) => {
    const conf = pluginApi.getConf<PluginData>('pluginData');
    const plg = new DefaultKwicRowConnectPlugin(
        pluginApi,
    );
    plg.init();
    return plg;
}

export default create;