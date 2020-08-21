/*
 * Copyright (c) 2020 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2020 Tomas Machalek <tomas.machalek@gmail.com>
 * Copyright (c) 2020 Martin Zimandl <martin.zimandl@gmail.com>
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

import { List, pipe } from 'cnc-tskit';
import { createElement } from 'react';

import { PluginInterfaces, IPluginApi } from '../../types/plugins';
import { init as initView, SuggestionsViews, KnownRenderers } from './view';
import { Model, ProviderInfo } from './model';


declare var require:any;
require('./style.less');

/**
 *
 */
export class DefaultQuerySuggest implements PluginInterfaces.QuerySuggest.IPlugin {

    protected readonly pluginApi:IPluginApi;

    protected readonly views:SuggestionsViews;

    protected readonly

    protected readonly model:Model;

    protected readonly providers:Array<ProviderInfo>;

    constructor(
        pluginApi:IPluginApi,
        views:SuggestionsViews,
        model:Model,
        providers:Array<ProviderInfo>
    ) {
        this.pluginApi = pluginApi;
        this.views = views;
        this.model = model;
        this.providers = providers;
    }

    isActive():boolean {
        return true;
    }

    createElement(rendererId:string, data:unknown):React.ReactElement {
        switch (rendererId) {
            case KnownRenderers.ERROR:
                if (this.errorTypeGuard(data)) {
                    return createElement(this.views.error, {data});
                }
            break;
            case KnownRenderers.BASIC:
                if (this.basicTypeGuard(data)) {
                    return createElement(this.views.basic, {data});
                }
            break;
            default:
                return createElement(this.views.unsupported, {data});
        }
        return createElement(
            this.views.error,
            {data: `Invalid data for the ${rendererId} frontend`}
        );
    }

    listCurrentProviders():Array<string> {
        return List.map(
            v => v.heading,
            this.providers
        );
    }

    errorTypeGuard(data:unknown):data is Error {
        return data instanceof Error || typeof data === 'string';
    }

    basicTypeGuard(data:unknown):data is Array<string> {
        return data instanceof Array && List.every(v => typeof v === 'string', data);
    }

    isEmptyResponse<T>(v:PluginInterfaces.QuerySuggest.DataAndRenderer<T>):boolean {
        const data = v.contents;
        if (this.basicTypeGuard(data)) {
            return List.empty(data)
        }
        return !!data;
    }

}


const create:PluginInterfaces.QuerySuggest.Factory = (pluginApi) => {
    const providers = pipe(
        pluginApi.getNestedConf<Array<ProviderInfo>>('pluginData', 'query_suggest', 'providers'),
        List.map(
            item => ({
                ident: item.ident,
                frontendId: item.frontendId,
                queryTypes: item.queryTypes,
                heading: item.heading
            })
        )
    );
    const model = new Model(
        pluginApi.dispatcher(),
        {
            uiLang: pluginApi.getConf<string>('uiLang'),
            providers,
            isBusy: false,
            cache: [],
            suggestionArgs: {},
            activeSourceId: null
        },
        pluginApi
    );
    return new DefaultQuerySuggest(
        pluginApi,
        initView(pluginApi.dispatcher(), model, pluginApi.getComponentHelpers()),
        model,
        providers
    );
};

export default create;
