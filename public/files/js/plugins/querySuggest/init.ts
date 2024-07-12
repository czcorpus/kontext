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

import * as PluginInterfaces from '../../types/plugins';
import { init as initView, SuggestionsViews } from './view';
import { isEmptyResponse, Model } from './model';
import {
    isBasicFrontend, isPosAttrPairRelFrontend, isErrorFrontend, isPosAttrPairRelClickPayload,
    KnownRenderers, isCncExtendedSublemmaFrontendClickPayload, isCncExtendedSublemmaFrontend,
    isCncExhaustiveQueryInfoFrontend,
    isCncExhaustiveQueryInfoFrontendClickPayload,
} from './frontends';
import { AnyProviderInfo, isEnabledFor } from './providers';
import { AnyQuery, QuerySuggestion } from '../../models/query/query';
import { IPluginApi } from '../../types/plugins/common';
import { QueryFormType } from '../../models/query/actions';
import { QueryValueSubformat } from '../../types/plugins/querySuggest';
import { Actions as GlobalActions } from '../../models/common/actions';


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
                isPosAttrPairRelClickPayload(value)) {
            if (query.qtype === 'simple') {
                query.queryParsed[tokenIdx].isExtended = true;
                query.queryParsed[tokenIdx].args.splice(0);
                query.queryParsed[tokenIdx].args.push(tuple(value.attr1, value.attr1Val));
                if (value.attr2 && value.attr2Val) {
                    query.queryParsed[tokenIdx].args.push(tuple(value.attr2, value.attr2Val));
                    query.queryParsed[tokenIdx].value = value.attr2Val;

                } else {
                    query.queryParsed[tokenIdx].value = value.attr1Val;
                }
                query.query = List.map(v => v.value, query.queryParsed).join(' ');
                query.rawFocusIdx = pipe(
                    query.queryParsed,
                    List.slice(0, tokenIdx + 1),
                    List.map(
                        (item, i) =>
                            item.value.length + (i < tokenIdx ? item.trailingSpace.length : 0)
                    ),
                    List.foldl(
                        (acc, curr) => acc + curr, 0
                    )
                );
                query.rawAnchorIdx = query.rawFocusIdx;
                query.qmcase = true;

            } else {
                const attr = query.parsedAttrs[tokenIdx];
                const prefix = query.query.substring(0, attr.rangeAttr[0]);
                const newChunk = value.attr2 && value.attr2Val ?
                    `${value.attr2}="${value.attr2Val}"` :
                    `${value.attr1}="${value.attr1Val}"`;
                const postfix = query.query.substring(attr.rangeVal[1] + 1);
                query.rawFocusIdx = (prefix + newChunk).length;
                query.rawAnchorIdx = query.rawFocusIdx;
                query.query = prefix + newChunk + postfix;
            }

        } else if (provInfo.rendererId === KnownRenderers.CNC_EXTENDED_SUBLEMMA &&
            isCncExtendedSublemmaFrontendClickPayload(value)) {
            if (query.qtype === 'simple') {
                query.queryParsed[tokenIdx].isExtended = true;
                query.queryParsed[tokenIdx].args.splice(0);
                query.queryParsed[tokenIdx].args.push(tuple(value.attr1, value.attr1Val));
                if (value.attr3 && value.attr3Val) {
                    query.queryParsed[tokenIdx].args.push(tuple(value.attr3, value.attr3Val));
                    query.queryParsed[tokenIdx].value = value.attr3Val;

                } else if (value.attr2 && value.attr2Val) {
                    query.queryParsed[tokenIdx].args.push(tuple(value.attr2, value.attr2Val));
                    query.queryParsed[tokenIdx].value = value.attr2Val;

                } else {
                    query.queryParsed[tokenIdx].value = value.attr1Val;
                }
                query.query = List.map(v => v.value, query.queryParsed).join(' ');
                query.rawFocusIdx = pipe(
                    query.queryParsed,
                    List.slice(0, tokenIdx + 1),
                    List.map(
                        (item, i) =>
                            item.value.length + (i < tokenIdx ? item.trailingSpace.length : 0)
                    ),
                    List.foldl(
                        (acc, curr) => acc + curr, 0
                    )
                );
                query.rawAnchorIdx = query.rawFocusIdx;
                query.qmcase = true;
            }

        } else if (provInfo.rendererId === KnownRenderers.EXHAUSTIVE_QUERY_EVAL &&
                isCncExhaustiveQueryInfoFrontendClickPayload(value)) {
            this.pluginApi.dispatcher().dispatch<typeof GlobalActions.SwitchCorpus>({
                name: GlobalActions.SwitchCorpus.name,
                payload: {
                    corpora: [value.corpname],
                    subcorpus: null
                }
            });

        } else {
            throw new Error(`Failed to apply click operation with renderer ${provInfo.rendererId} and data ${JSON.stringify(value)}`);
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
                itemClickHandler: value => itemClickHandler(dr.providerId, value)
            });

        } else if (isCncExtendedSublemmaFrontend(dr)) {
            return createElement(this.views.cncExtendedSublemma, {
                ...dr.contents,
                isShortened: dr.isShortened,
                itemClickHandler: value => itemClickHandler(dr.providerId, value)
            });

        } else if (isCncExhaustiveQueryInfoFrontend(dr)) {
            return createElement(this.views.exhaustiveQuery, {
                yes: dr.contents.yes,
                no: dr.contents.no,
                altCorpus: dr.contents.alt_corpus,
                isShortened: dr.isShortened,
                itemClickHandler: value => itemClickHandler(dr.providerId, value)
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

    suggestionsAvailableFor(
        formType:QueryFormType,
        valueSubformat:QueryValueSubformat,
        posAttr:string|undefined
    ):boolean {
        return List.some(
            provider => isEnabledFor(
                provider,
                formType,
                valueSubformat,
                posAttr
            ),
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
    const providersConf = pluginApi.getNestedConf<Array<AnyProviderInfo>>('pluginData', 'query_suggest', 'providers');
    const providers = pipe(
        providersConf || [],
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
