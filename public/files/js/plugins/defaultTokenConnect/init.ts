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

import {Kontext} from '../../types/common';
import {PluginInterfaces, IPluginApi} from '../../types/plugins';
import {init as initView, Views as DefaultTokenConnectRenderers} from './view';
import RSVP from 'rsvp';
import {MultiDict} from '../../util';
import * as Immutable from 'immutable';

declare var require:any;
require('./style.less');


/**
 *
 */
export class DefaultTokenConnectBackend implements PluginInterfaces.TokenConnect.IPlugin {

    private pluginApi:IPluginApi;

    private views:DefaultTokenConnectRenderers;

    alignedCorpora:Immutable.List<string>;

    constructor(pluginApi:IPluginApi, views:DefaultTokenConnectRenderers, alignedCorpora:Array<string>) {
        this.pluginApi = pluginApi;
        this.views = views;
        this.alignedCorpora = Immutable.List<string>(alignedCorpora);
    }

    fetchTokenConnect(corpusId:string, tokenId:number):RSVP.Promise<Array<PluginInterfaces.TokenConnect.DataAndRenderer>> {
        const args = new MultiDict();
        args.set('corpname', corpusId);
        args.set('token_id', tokenId);
        args.replace('align', this.alignedCorpora.toArray());
        return this.pluginApi.ajax<PluginInterfaces.TokenConnect.Response>(
            'GET',
            this.pluginApi.createActionUrl('fetch_token_detail'),
            args

        ).then(
            (data:PluginInterfaces.TokenConnect.Response) =>
                data.items.map<PluginInterfaces.TokenConnect.DataAndRenderer>(x => {
                    return {
                        renderer: this.selectRenderer(x.renderer),
                        contents: x.contents,
                        found: x.found,
                        heading: x.heading
                    };
                })
        );
    }

    selectRenderer(typeId:string):PluginInterfaces.TokenConnect.Renderer {
        switch (typeId) {
            case 'raw-html':
                return this.views.RawHtmlRenderer;
            case 'simple-tabular':
                return this.views.SimpleTabularRenderer;
            case 'simple-description-list':
                return this.views.DescriptionListRenderer;
            case 'datamuse-json':
                return this.views.DataMuseSimilarWords;
            case 'vallex-json':
                return this.views.VallexJsonRenderer;
            default:
                return this.views.UnsupportedRenderer;
        }
    }
}


const create:PluginInterfaces.TokenConnect.Factory = (pluginApi, alignedCorpora) => {
    return new DefaultTokenConnectBackend(
        pluginApi,
        initView(pluginApi.dispatcher(), pluginApi.getComponentHelpers()),
        alignedCorpora
    );
};

export default create;
