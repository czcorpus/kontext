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

/// <reference path="../../types/common.d.ts" />
/// <reference path="../../../ts/declarations/rsvp.d.ts" />

import {TagHelperStore} from './stores';
import {init as viewInit} from './view';
import {TooltipBox} from '../../popupbox';
import * as RSVP from 'vendor/rsvp';



export class TagHelperPlugin implements Kontext.PluginObject<TagHelperStore> {

    private pluginApi:Kontext.PluginApi;

    private store:TagHelperStore;

    private views:Kontext.MultipleViews;

    constructor() {
    }

    getViews():Kontext.MultipleViews {
        return this.views;
    }


    create(pluginApi:Kontext.PluginApi):RSVP.Promise<TagHelperStore> {
        this.pluginApi = pluginApi;
        this.store = new TagHelperStore(pluginApi);
        this.views = viewInit(
            this.pluginApi.dispatcher(),
            this.pluginApi.exportMixins(),
            this.store
        );

        return new RSVP.Promise<TagHelperStore>((resolve:(d:any)=>void, reject:(e:any)=>void) => {
            resolve(this.store);
        });
    }
}

export default new TagHelperPlugin();