/*
 * Copyright (c) 2017 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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
import { init as initView, Views as DefaultTokenConnectRenderers } from './views';
import { KnownRenderers } from '../defaultKwicConnect/model';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { HTTP, List, pipe } from 'cnc-tskit';
import { IPluginApi } from '../../types/plugins/common';


export type ServerExportedConf = {
    providers:Array<{is_kwic_view:boolean, ident:string}>;
}

/**
 *
 */
export class DefaultTokenConnectBackend implements PluginInterfaces.TokenConnect.IPlugin {

    protected pluginApi:IPluginApi;

    protected views:DefaultTokenConnectRenderers;

    protected alignedCorpora:Array<string>;

    protected providers:Array<{ident:string, isKwicView:boolean}>;

    constructor(
        pluginApi:IPluginApi,
        views:DefaultTokenConnectRenderers,
        alignedCorpora:Array<string>,
        conf:ServerExportedConf
    ) {
        this.pluginApi = pluginApi;
        this.views = views;
        this.alignedCorpora = alignedCorpora;
        this.providers = List.map(
            v => ({ident: v.ident, isKwicView: v.is_kwic_view}),
            conf.providers
        );
    }

    isActive():boolean {
        return true;
    }

    fetchTokenConnect(
        corpusId:string,
        tokenId:number,
        numTokens:number,
        context?:[number, number]
    ):Observable<PluginInterfaces.TokenConnect.TCData> {

        return this.pluginApi.ajax$<PluginInterfaces.TokenConnect.Response>(
            HTTP.Method.GET,
            this.pluginApi.createActionUrl('fetch_token_detail'),
            {
                corpname: corpusId,
                token_id: tokenId,
                num_tokens: numTokens,
                detail_left_ctx: context && context[0] ? context[0] : undefined,
                detail_right_ctx: context && context[1] ? context[1] : undefined,
                align: this.alignedCorpora
            }

        ).pipe(
            map(
                (data:PluginInterfaces.TokenConnect.Response) => ({
                    token: data.token,
                    renders: pipe(
                        data.items,
                        List.map(
                            x => ({
                                renderer: this.selectRenderer(x.renderer),
                                isKwicView: x.is_kwic_view,
                                contents: x.contents,
                                found: x.status,
                                heading: x.heading
                            }),
                        )
                    )
                })
            )
        );
    }

    selectRenderer(typeId:string):PluginInterfaces.TokenConnect.Renderer {
        switch (typeId) {
            case KnownRenderers.DISPLAY_LINK:
                return this.views.DisplayLinkRenderer;
            case KnownRenderers.RAW_HTML:
                return this.views.RawHtmlRenderer;
            case KnownRenderers.SIMPLE_TABULAR:
                return this.views.SimpleTabularRenderer;
            case KnownRenderers.SIMPLE_DESCRIPTION_LIST:
                return this.views.DescriptionListRenderer;
            case KnownRenderers.DATAMUSE:
                return this.views.DataMuseSimilarWords;
            case KnownRenderers.ERROR:
                return this.views.ErrorRenderer;
            case KnownRenderers.FORMATTED_TEXT:
                return this.views.FormattedTextRenderer;
            default:
                return this.views.UnsupportedRenderer;
        }
    }

    providesAnyTokenInfo():boolean {
        return this.providers.some(p => !p.isKwicView);
    }
}


const create:PluginInterfaces.TokenConnect.Factory = (pluginApi, alignedCorpora) => {
    const plgConf = pluginApi.getNestedConf<ServerExportedConf>('pluginData', 'token_connect');
    return new DefaultTokenConnectBackend(
        pluginApi,
        initView(pluginApi.dispatcher(), pluginApi.getComponentHelpers()),
        alignedCorpora,
        plgConf ? plgConf : {providers: []}
    );
};

export default create;
