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

import {PluginInterfaces, IPluginApi} from '../../types/plugins';
import {init as initView, Views as DefaultTokenConnectRenderers} from './view';
import {MultiDict} from '../../multidict';
import * as Immutable from 'immutable';
import { KnownRenderers } from '../defaultKwicConnect/model';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { HTTP } from 'cnc-tskit';


declare var require:any;
require('./style.less');


export type ServerExportedConf = {
    providers:Array<{is_kwic_view:boolean, ident:string}>;
}

/**
 *
 */
export class DefaultTokenConnectBackend implements PluginInterfaces.TokenConnect.IPlugin {

    protected pluginApi:IPluginApi;

    protected views:DefaultTokenConnectRenderers;

    protected alignedCorpora:Immutable.List<string>;

    protected providers:Immutable.List<{ident:string, isKwicView:boolean}>;

    constructor(pluginApi:IPluginApi, views:DefaultTokenConnectRenderers, alignedCorpora:Array<string>, conf:ServerExportedConf) {
        this.pluginApi = pluginApi;
        this.views = views;
        this.alignedCorpora = Immutable.List<string>(alignedCorpora);
        this.providers = Immutable.List<{ident:string; isKwicView:boolean}>(conf.providers.map(v => ({ident: v.ident, isKwicView: v.is_kwic_view})));
    }

    fetchTokenConnect(corpusId:string, tokenId:number, numTokens:number):Observable<PluginInterfaces.TokenConnect.TCData> {
        const args = new MultiDict();
        args.set('corpname', corpusId);
        args.set('token_id', tokenId);
        args.set('num_tokens', numTokens);
        args.replace('align', this.alignedCorpora.toArray());
        return this.pluginApi.ajax$<PluginInterfaces.TokenConnect.Response>(
            HTTP.Method.GET,
            this.pluginApi.createActionUrl('fetch_token_detail'),
            args

        ).pipe(
            map(
                (data:PluginInterfaces.TokenConnect.Response) => ({
                    token: data.token,
                    renders: data.items.map(x => ({
                        renderer: this.selectRenderer(x.renderer),
                        isKwicView: x.is_kwic_view,
                        contents: x.contents,
                        found: x.found,
                        heading: x.heading
                    }))
                })
            )
        );
    }

    selectRenderer(typeId:string):PluginInterfaces.TokenConnect.Renderer {
        switch (typeId) {
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
            default:
                return this.views.UnsupportedRenderer;
        }
    }

    providesAnyTokenInfo():boolean {
        return this.providers.some(p => !p.isKwicView);
    }
}


const create:PluginInterfaces.TokenConnect.Factory = (pluginApi, alignedCorpora) => {
    return new DefaultTokenConnectBackend(
        pluginApi,
        initView(pluginApi.dispatcher(), pluginApi.getComponentHelpers()),
        alignedCorpora,
        pluginApi.getNestedConf<ServerExportedConf>('pluginData', 'token_connect')
    );
};

export default create;
