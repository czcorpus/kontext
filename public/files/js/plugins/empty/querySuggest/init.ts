/*
 * Copyright (c) 2020 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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

import { QueryFormType } from '../../../models/query/actions.js';
import { AnyQuery, QuerySuggestion } from '../../../models/query/query.js';
import * as PluginInterfaces from '../../../types/plugins/index.js';
import { IPluginApi } from '../../../types/plugins/common.js';
import { QueryValueSubformat } from '../../../types/plugins/querySuggest.js';

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

    applyClickOnItem(query:AnyQuery, tokenIdx:number, providerId:string, value:unknown):void {}

    createElement<T>(
        dr:QuerySuggestion<T>,
        itemClickHandler:(providerId:string, value:unknown)=>void
    ):React.ReactElement {
        return null;
    }

    listCurrentProviders():Array<string> {
        return [];
    }

    suggestionsAvailableFor(formType:QueryFormType, valueSubformat:QueryValueSubformat, posAttr:string|undefined):boolean {
        return false;
    }

    isEmptyResponse<T>(v:QuerySuggestion<T>):boolean {
        return true;
    }

    unregister():void {}

    getRegistrationId():string {
        return 'empty-query-suggest-plugin';
    }

}


const create:PluginInterfaces.QuerySuggest.Factory = (pluginApi) => {
    return new EmptyQuerySuggest(pluginApi);
};

export default create;
