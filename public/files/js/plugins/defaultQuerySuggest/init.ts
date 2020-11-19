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

import { List, pipe, tuple } from 'cnc-tskit';
import { createElement } from 'react';

import { PluginInterfaces, IPluginApi } from '../../types/plugins';
import { init as initView, KnownRenderers, SuggestionsViews } from './view';
import { isEmptyResponse, Model } from './model';
import { isBasicFrontend, isPosAttrPairRelFrontend, isErrorFrontend, isPosAttrPairRelClickValue } from './frontends';
import { AnyProviderInfo } from './providers';
import { AnyQuery, calcCursorEndPosition, QuerySuggestion } from '../../models/query/query';


declare var require:any;
require('./style.less');

/**
 *
 */
export class DefaultQuerySuggest implements PluginInterfaces.QuerySuggest.IPlugin {

    protected readonly pluginApi:IPluginApi;

    protected readonly views:SuggestionsViews;

    protected readonly model:Model;

    protected readonly providers:Array<AnyProviderInfo>;

    constructor(
        pluginApi:IPluginApi,
        views:SuggestionsViews,
        model:Model,
        providers:Array<AnyProviderInfo>
    ) {
        this.pluginApi = pluginApi;
        this.views = views;
        this.model = model;
        this.providers = providers;
    }

    isActive():boolean {
        return !List.empty(this.providers);
    }

    applyClickOnItem(query:AnyQuery, tokenIdx:number, providerId:string, value:unknown):void {
        const provInfo = List.find(p => p.ident === providerId, this.providers);
        if (!provInfo) {
            throw new Error(`Cannot find provider ${providerId}`);
        }
        if (provInfo.rendererId === KnownRenderers.BASIC && typeof value === 'string') {

        } else if (provInfo.rendererId === KnownRenderers.POS_ATTR_PAIR_REL &&
                isPosAttrPairRelClickValue(value)) {
            if (query.qtype === 'simple') {
                query.queryParsed[tokenIdx].isExtended = true;
                query.queryParsed[tokenIdx].args.splice(0);
                query.queryParsed[tokenIdx].args.push(tuple(value[0], value[1]));
                if (value[2] && value[3]) {
                    query.queryParsed[tokenIdx].args.push(tuple(value[2], value[3]));
                    query.queryParsed[tokenIdx].value = value[3];

                } else {
                    query.queryParsed[tokenIdx].value = value[1];
                }
                query.query = List.map(v => v.value, query.queryParsed).join(' ');
                query.rawFocusIdx = calcCursorEndPosition(query, tokenIdx);
                query.rawAnchorIdx = query.rawFocusIdx;

            } else {
                const attr = query.parsedAttrs[tokenIdx];
                query.query = query.query.substring(0, attr.rangeAttr[0]) + value[2] + '=' +
                    '"' + value[3] + '"' + query.query.substring(attr.rangeVal[1] + 1);

            }

        } else {
            throw new Error(`Failed to apply click operation with renderer ${provInfo.rendererId} and data ${value}`);
        }
    }

    createElement<T>(
        dr:QuerySuggestion<T>,
        itemClickHandler:(providerId:string, value:unknown)=>void
    ):React.ReactElement {

        if (isBasicFrontend(dr)) {
            return createElement(this.views.basic, {
                data: dr.contents,
                itemClickHandler: (value:string) => itemClickHandler(dr.providerId, value)
            });

        } else if (isPosAttrPairRelFrontend(dr)) {
            return createElement(this.views.posAttrPairRel, {
                ...dr.contents,
                isShortened: dr.isShortened,
                itemClickHandler: (value:[string, string, string, string]) => itemClickHandler(dr.providerId, value)
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

    isEmptyResponse<T>(v:QuerySuggestion<T>):boolean {
        return isEmptyResponse(v);
    }

    unregister():void {
        this.model.unregister();
    }

    getRegistrationId():string {
        return 'default-query-suggest-plugin';
    }

}


const create:PluginInterfaces.QuerySuggest.Factory = (pluginApi) => {
    const providers = pipe(
        pluginApi.getNestedConf<Array<AnyProviderInfo>>('pluginData', 'query_suggest', 'providers'),
        List.map(item => ({...item}))
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
