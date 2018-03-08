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
import {init as initView, Views as DefaultTokenDetailRenderers} from './view';
import RSVP from 'rsvp';
import {MultiDict} from '../../util';
import * as Immutable from 'immutable';


export class DefaultTokenDetailBackend implements PluginInterfaces.TokenDetail.IPlugin {

    private pluginApi:IPluginApi;

    private views:DefaultTokenDetailRenderers;

    alignedCorpora:Immutable.List<string>;

    constructor(pluginApi:IPluginApi, views:DefaultTokenDetailRenderers, alignedCorpora:Array<string>) {
        this.pluginApi = pluginApi;
        this.views = views;
        this.alignedCorpora = Immutable.List<string>(alignedCorpora);
    }

    fetchTokenDetail(corpusId:string, tokenId:number):RSVP.Promise<Array<PluginInterfaces.TokenDetail.DataAndRenderer>> {
        const args = new MultiDict();
        args.set('corpname', corpusId);
        args.set('token_id', tokenId);
        args.replace('align', this.alignedCorpora.toArray());
        return this.pluginApi.ajax<PluginInterfaces.TokenDetail.Response>(
            'GET',
            this.pluginApi.createActionUrl('fetch_token_detail'),
            args

        ).then(
            (data:PluginInterfaces.TokenDetail.Response) => {
                return data.items.map<PluginInterfaces.TokenDetail.DataAndRenderer>(x => ({
                    renderer: this.selectRenderer(x.renderer),
                    contents: x.contents,
                    found: x.found,
                    heading: x.heading
                }));
            }
        );
    }

    selectRenderer(typeId:string):PluginInterfaces.TokenDetail.Renderer {
        switch (typeId) {
            case 'raw-html':
                return this.views.RawHtmlRenderer;
            case 'simple-tabular':
                return this.views.SimpleTabularRenderer;
            case 'simple-description-list':
                return this.views.DescriptionListRenderer;
            default:
                return this.views.UnsupportedRenderer;
        }
    }

}


export default function create(pluginApi:IPluginApi,
        alignedCorpora:Array<string>):RSVP.Promise<PluginInterfaces.TokenDetail.IPlugin> {
    return new RSVP.Promise<PluginInterfaces.TokenDetail.IPlugin>(
        (resolve:(d)=>void, reject:(err)=>void) => {
            resolve(new DefaultTokenDetailBackend(
                pluginApi,
                initView(pluginApi.dispatcher(), pluginApi.getComponentHelpers()),
                alignedCorpora
            ));
        }
    );
}