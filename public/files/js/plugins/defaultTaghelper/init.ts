/*
 * Copyright (c) 2016 Institute of the Czech National Corpus
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
import {TagHelperModel} from './models';
import {init as viewInit} from './view';
import RSVP from 'rsvp';

declare var require:any;
require('./style.less'); // webpack


export class TagHelperPlugin implements PluginInterfaces.ITagHelper {

    private pluginApi:IPluginApi;

    private model:TagHelperModel;

    constructor(pluginApi:IPluginApi, model:TagHelperModel) {
        this.pluginApi = pluginApi;
        this.model = model;
    }

    getWidgetView():React.ComponentClass {
        return viewInit(
            this.pluginApi.dispatcher(),
            this.pluginApi.getComponentHelpers(),
            this.model
        ).TagBuilder;
    }
}

export default function create(pluginApi:IPluginApi):RSVP.Promise<PluginInterfaces.ITagHelper> {
    const plugin = new TagHelperPlugin(
        pluginApi,
        new TagHelperModel(
            pluginApi.dispatcher(),
            pluginApi,
            pluginApi.getConf<string>('corpname')
        )
    );
    return new RSVP.Promise<PluginInterfaces.ITagHelper>((resolve:(d:any)=>void, reject:(e:any)=>void) => {
        resolve(plugin);
    });
}