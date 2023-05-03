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
import { StatefulModel, IFullActionControl } from 'kombo';
import { IPluginApi } from '../../types/plugins/common';


export interface KwicRowConnectState {
    isBusy:boolean;
}


export interface KwicRowConnectModelArgs {
    dispatcher:IFullActionControl;
    pluginApi:IPluginApi;
}

export class KwicRowConnectModel extends StatefulModel<KwicRowConnectState> {

    private pluginApi:IPluginApi;

    constructor({
            dispatcher,
            pluginApi,
    }:KwicRowConnectModelArgs) {
        super(
            dispatcher,
            {
                isBusy: false,
            }
        );
        this.pluginApi = pluginApi;

        this.addActionHandler(
            PluginInterfaces.KwicRowConnect.Actions.FetchInfo,
            action => {
                console.log('KwicRowConnect dispatched', action.payload);
            }
        );
    }
}