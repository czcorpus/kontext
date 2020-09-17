/*
 * Copyright (c) 2020 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2020 Tomas Machalek <tomas.machalek@gmail.com>
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

import { PluginInterfaces, IPluginApi } from '../../../types/plugins';

/**
 *
 */
export class EmptyQuerySuggest implements PluginInterfaces.QuerySuggest.IPlugin {

    protected readonly pluginApi:IPluginApi;

    constructor(pluginApi:IPluginApi) {
        this.pluginApi = pluginApi;
    }

    isActive():boolean {
        return true;
    }

    createElement<T>(dr:PluginInterfaces.QuerySuggest.DataAndRenderer<T>):React.ReactElement {
        return null;
    }

    listCurrentProviders():Array<string> {
        return [];
    }

    isEmptyResponse<T>(v:PluginInterfaces.QuerySuggest.DataAndRenderer<T>):boolean {
        return true;
    }

}


const create:PluginInterfaces.QuerySuggest.Factory = (pluginApi) => {
    return new EmptyQuerySuggest(pluginApi);
};

export default create;
