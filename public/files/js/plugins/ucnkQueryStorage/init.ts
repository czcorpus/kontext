/*
 * Copyright (c) 2014 Institute of the Czech National Corpus
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
/// <reference path="../../../ts/declarations/jquery.d.ts" />
/// <reference path="../../../ts/declarations/rsvp.d.ts" />

import * as RSVP from 'vendor/rsvp';
import {QueryStorageStore} from './stores';
import {init as viewsInit} from './view';

export class QueryStoragePlugin implements Kontext.PluginObject<any> {

    private pluginApi:Kontext.PluginApi;

    private views:Kontext.MultipleViews;

    private store:QueryStorageStore;

    getViews():Kontext.MultipleViews {
        return this.views;
    }


    create(pluginApi:Kontext.PluginApi):RSVP.Promise<any> {
        this.pluginApi = pluginApi;
        this.store = new QueryStorageStore(this.pluginApi);
        this.views = viewsInit(this.pluginApi.dispatcher(), this.pluginApi.exportMixins(), this.store);
        return new RSVP.Promise<any>((resolve:(d:any)=>void, reject:(e:any)=>void) => {
            resolve(this.store);
        });

    }
}

export default new QueryStoragePlugin();
