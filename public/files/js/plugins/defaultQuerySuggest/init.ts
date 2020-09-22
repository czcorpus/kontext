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

import { List, pipe, Dict } from 'cnc-tskit';
import { createElement } from 'react';

import { PluginInterfaces, IPluginApi } from '../../types/plugins';
import { init as initView, SuggestionsViews } from './view';
import { Model, ProviderInfo } from './model';
import { isBasicFrontend, isPosAttrPairRelFrontend, isErrorFrontend } from './frontends';


declare var require:any;
require('./style.less');

/**
 *
 */
export class DefaultQuerySuggest implements PluginInterfaces.QuerySuggest.IPlugin {

    protected readonly pluginApi:IPluginApi;

    protected readonly views:SuggestionsViews;

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

    createElement<T>(
        dr:PluginInterfaces.QuerySuggest.DataAndRenderer<T>,
        itemClickHandler:(onItemClick, value)=>void
    ):React.ReactElement {

        const onItemClick = List.find(
            v => v.rendererId === dr.rendererId,
            this.providers
        ).onItemClick;

        if (isBasicFrontend(dr)) {
            return createElement(this.views.basic, {
                data: dr.contents,
                itemClickHandler: onItemClick ?
                    value => itemClickHandler(onItemClick, value) :
                    null
            });

        } else if (isPosAttrPairRelFrontend(dr)) {
            return createElement(this.views.posAttrPairRel, {
                ...dr.contents,
                itemClickHandler: onItemClick ?
                    value => itemClickHandler(onItemClick, value) :
                    null
            });

        } else if (isErrorFrontend(dr)) {
            return createElement(this.views.error, {data: dr.contents});

        } else {
            return createElement(this.views.unsupported, {data: dr.contents});
        }
    }

    listCurrentProviders():Array<string> {
        return List.map(
            v => v.heading,
            this.providers
        );
    }

    isEmptyResponse<T>(v:PluginInterfaces.QuerySuggest.DataAndRenderer<T>):boolean {
        if (v === undefined) {
            return true;
        }
        const data = v.contents;
        if (isBasicFrontend(v)) {
            return List.empty(v.contents);

        } else if (isPosAttrPairRelFrontend(v)) {
            return Dict.empty(v.contents.data);

        } else if (isErrorFrontend(v)) {
            return false;
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
                rendererId: item.rendererId,
                queryTypes: item.queryTypes,
                heading: item.heading,
                onItemClick: item.onItemClick
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
