/*
 * Copyright (c) 2018 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
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

import RSVP from 'rsvp';
import {PluginInterfaces, IPluginApi} from '../../types/plugins';
import {init as viewInit, View} from './views';
import {init as renderersInit, Views as RenderersView} from './renderers';
import {KwicConnectModel, RendererMap} from './model';

export class DefaultKwicConnectPlugin implements PluginInterfaces.KwicConnect.IPlugin {

    private pluginApi:IPluginApi;

    private model:KwicConnectModel;

    private views:View;

    private renderers:RenderersView;

    constructor(pluginApi:IPluginApi) {
        this.pluginApi = pluginApi;
        this.model = new KwicConnectModel(
            pluginApi.dispatcher(),
            pluginApi,
            this.selectRenderer.bind(this)
        );
    }

    getView():React.ComponentClass<{}>|React.SFC<{}> {
        return this.views.KwicConnectWidget;
    }

    selectRenderer(typeId:string):PluginInterfaces.TokenDetail.Renderer {
        switch (typeId) {
            case 'raw-html':
                return this.renderers.RawHtmlRenderer;
            case 'datamuse-json':
                return this.renderers.DataMuseSimilarWords;
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


export default function create(pluginApi:IPluginApi, alignedCorpora:Array<string>):RSVP.Promise<PluginInterfaces.KwicConnect.IPlugin> {
    const plg = new DefaultKwicConnectPlugin(pluginApi);
    plg.init();
    return RSVP.resolve(plg);
}