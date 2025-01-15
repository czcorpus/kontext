/*
 * Copyright (c) 2017 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
 * Copyright (c) 2018 Kira Droganova
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

import { DefaultTokenConnectBackend } from '../tokenConnect/init.js';
import * as PluginInterfaces from '../../types/plugins/index.js';
import { init as initDefaultView, Views as DefaultTokenConnectRenderers } from '../tokenConnect/views.js';
import { init as initLindatView, Views as LindatTokenConnectRenderers } from './view.js';
import { KnownRenderers } from '../kwicConnect/model.js';
import { IPluginApi } from '../../types/plugins/common.js';

declare var require:any;
require('../tokenConnect/style.css');


export type ServerExportedConf = {
    providers:Array<{is_kwic_view:boolean, ident:string}>;
}


export class LindatTokenConnectBackend extends DefaultTokenConnectBackend {


    private lindatViews:LindatTokenConnectRenderers;

    constructor(
        pluginApi:IPluginApi,
        defaultViews:DefaultTokenConnectRenderers,
        lindatView:LindatTokenConnectRenderers,
        alignedCorpora:Array<string>,
        conf:ServerExportedConf
    ) {
        super(pluginApi, defaultViews, alignedCorpora, conf);
        this.lindatViews = lindatView;
        this.alignedCorpora = alignedCorpora;
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
            case 'vallex-json':
                return this.lindatViews.VallexJsonRenderer;
            case 'pdt-vallex-json':
                return this.lindatViews.PDTVallexJsonRenderer;
            case 'eng-vallex-json':
                return this.lindatViews.EngVallexJsonRenderer;
            case KnownRenderers.FORMATTED_TEXT:
                    return this.views.FormattedTextRenderer;
            default:
                return this.views.UnsupportedRenderer;
        }
    }
}


const create:PluginInterfaces.TokenConnect.Factory = (pluginApi, alignedCorpora) => {
    return new LindatTokenConnectBackend(
        pluginApi,
        initDefaultView(pluginApi.dispatcher(), pluginApi.getComponentHelpers()),
        initLindatView(pluginApi.dispatcher(), pluginApi.getComponentHelpers()),
        alignedCorpora,
        pluginApi.getNestedConf<ServerExportedConf>('pluginData', 'token_connect')
    );
};

export default create;