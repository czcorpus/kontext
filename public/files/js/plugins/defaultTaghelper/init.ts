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

/// <reference path="../../types/plugins.d.ts" />
/// <reference path="../../vendor.d.ts/rsvp.d.ts" />

import {Kontext} from '../../types/common';
import {PluginInterfaces} from '../../types/plugins';
import {TagHelperStore} from './stores';
import {init as viewInit} from './view';
import * as RSVP from 'vendor/rsvp';

declare var require:any;
require('./style.less'); // webpack


export class TagHelperPlugin implements PluginInterfaces.ITagHelper {

    private pluginApi:Kontext.PluginApi;

    private store:TagHelperStore;

    constructor(pluginApi:Kontext.PluginApi, store:TagHelperStore) {
        this.pluginApi = pluginApi;
        this.store = store;
    }

    getWidgetView():React.ComponentClass {
        return viewInit(
            this.pluginApi.dispatcher(),
            this.pluginApi.getComponentHelpers(),
            this.store
        ).TagBuilder;
    }
}

export default function create(pluginApi:Kontext.PluginApi):RSVP.Promise<PluginInterfaces.ITagHelper> {
    const plugin = new TagHelperPlugin(pluginApi, new TagHelperStore(pluginApi.dispatcher(), pluginApi));
    return new RSVP.Promise<PluginInterfaces.ITagHelper>((resolve:(d:any)=>void, reject:(e:any)=>void) => {
        resolve(plugin);
    });
}