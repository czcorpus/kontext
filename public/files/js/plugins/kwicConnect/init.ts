/*
 * Copyright (c) 2018 Charles University, Faculty of Arts,
 *                    Department of Linguistics
 * Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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
import { init as viewInit, View } from './views.js';
import { init as renderersInit, Views as RenderersView } from './renderers.js';
import { KwicConnectModel, KnownRenderers } from './model.js';
import { List } from 'cnc-tskit';
import { IPluginApi } from '../../types/plugins/common.js';
import { RendererData } from '../../types/plugins/tokenConnect.js';

declare var require:any;
require('./style.css'); // webpack


interface PluginData {
    kwic_connect: {
        load_chunk_size:number;
        max_kwic_words:number
    }
}


export class DefaultKwicConnectPlugin implements PluginInterfaces.KwicConnect.IPlugin {

    private pluginApi:IPluginApi;

    private model:KwicConnectModel;

    private views:View;

    private renderers:RenderersView;


    constructor(
        pluginApi:IPluginApi,
        maxKwicWords:number,
        loadChunkSize:number,
        isUnfinishedCalculation:boolean
    ) {
        this.pluginApi = pluginApi;
        const concArgs = this.pluginApi.getConcArgs();
        this.model = new KwicConnectModel({
            dispatcher: pluginApi.dispatcher(),
            pluginApi,
            corpora: List.concat(
                pluginApi.getConf<Array<string>>('alignedCorpora'),
                [pluginApi.getCorpusIdent().id]
            ),
            mainCorp: concArgs.maincorp ?
                        concArgs.maincorp :
                        pluginApi.getCorpusIdent().id,
            rendererMap: this.selectRenderer.bind(this),
            loadChunkSize,
            maxKwicWords,
            isUnfinishedCalculation
        });
    }

    isActive():boolean {
        return true;
    }

    getWidgetView():React.ComponentClass<{}>|React.FC<{}> {
        return this.views.KwicConnectContainer;
    }

    selectRenderer(typeId:KnownRenderers):PluginInterfaces.TokenConnect.Renderer {
        switch (typeId) {
            case KnownRenderers.DISPLAY_LINK:
                return this.renderers.DisplayLinkRenderer;
            case KnownRenderers.RAW_HTML:
                return this.renderers.RawHtmlRenderer;
            case KnownRenderers.DATAMUSE:
                return this.renderers.DataMuseSimilarWords;
            case KnownRenderers.TREQ:
                return this.renderers.TreqRenderer;
            case KnownRenderers.MESSAGE:
                return this.renderers.CustomMessageRenderer;
            default:
                return this.renderers.UnsupportedRenderer;
        }
    }

    init():void {
        this.views = viewInit(
            this.pluginApi.dispatcher(),
            this.pluginApi.getComponentHelpers(),
            this.model
        );
        this.renderers = renderersInit(
            this.pluginApi.dispatcher(),
            this.pluginApi.getComponentHelpers()
        );
    }
}


export const create:PluginInterfaces.KwicConnect.Factory = (
            pluginApi:IPluginApi,
            alignedCorpora:Array<string>,
            isUnfinishedCalculation:boolean) => {
    const conf = pluginApi.getConf<PluginData>('pluginData');
    const plg = new DefaultKwicConnectPlugin(
        pluginApi,
        conf.kwic_connect.max_kwic_words,
        conf.kwic_connect.load_chunk_size,
        isUnfinishedCalculation
    );
    plg.init();
    return plg;
}

export default create;