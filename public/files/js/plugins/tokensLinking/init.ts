/*
 * Copyright (c) 2023 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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

import * as PluginInterfaces from '../../types/plugins/index.js';
import { TokensLinkingModel } from './model.js';
import { IPluginApi } from '../../types/plugins/common.js';
import { List, pipe } from 'cnc-tskit';


interface PluginData {
    tokens_linking: {}
}


export class TokensLinkingPlugin implements PluginInterfaces.TokensLinking.IPlugin {

    private pluginApi:IPluginApi;

    private model:TokensLinkingModel;

    constructor(
        pluginApi:IPluginApi,
    ) {
        this.pluginApi = pluginApi;
        this.model = new TokensLinkingModel({
            dispatcher: pluginApi.dispatcher(),
            pluginApi,
            corpora: pipe(
                pluginApi.getConf<Array<string>>('alignedCorpora'),
                List.concatr([pluginApi.getCorpusIdent().id])
            )
        });
    }

    isActive():boolean {
        return true;
    }

    init():void {
    }
}


export const create:PluginInterfaces.TokensLinking.Factory = (
            pluginApi:IPluginApi,
    ) => {
    const conf = pluginApi.getConf<PluginData>('pluginData');
    const plg = new TokensLinkingPlugin(
        pluginApi,
    );
    plg.init();
    return plg;
}

export default create;